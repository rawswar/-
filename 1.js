async function getPopularAnime(params = {}) {
    const url = "https://bgm.tv/anime/browser/?sort=trends";
    // Selector for anime items on the page [1]
    return fetchAndProcessAnimeList(url, "#browserItemList li.item");
}

async function getAnimeByYear(params = {}) {
    if (!params.year || !/^\d{4}$/.test(params.year)) {
        throw new Error("年份参数缺失或格式不正确 (应为4位数字)");
    }
    const year = params.year;
    const url = `https://bgm.tv/anime/browser/airtime/${year}?sort=rank`;
    // Assuming similar page structure for yearly anime list [1]
    return fetchAndProcessAnimeList(url, "#browserItemList li.item");
}

async function fetchAndProcessAnimeList(url, itemSelector) {
    try {
        console.log("Fetching URL:", url);
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ForwardWidget/1.0"
            }
        });

        if (!response || !response.data) {
            throw new Error("未能获取到有效的页面数据。");
        }

        const docId = Widget.dom.parse(response.data);
        if (!docId) {
            throw new Error("HTML 解析失败。");
        }

        const elements = Widget.dom.select(docId, itemSelector);
        if (!elements || elements.length === 0) {
            console.log("No elements found with selector:", itemSelector, "on page:", url);
            return []; // Return empty array if no items found
        }

        return elements.map(elementId => {
            const titleElement = Widget.dom.selectFirst(elementId, "h3.title a");
            const title = titleElement ? Widget.dom.text(titleElement) : "N/A";
            const itemLinkRelative = titleElement ? Widget.dom.attr(titleElement, "href") : "";
            const itemLink = itemLinkRelative ? "https://bgm.tv" + itemLinkRelative : "";

            // Extract ID from link, e.g., /subject/12345 -> 12345 [1]
            const subjectIdMatch = itemLinkRelative.match(/\/subject\/(\d+)/);
            const id = subjectIdMatch ? subjectIdMatch[1] : `bgm_${Math.random().toString(36).substr(2, 9)}`;

            const coverElement = Widget.dom.selectFirst(elementId, "a.ll img");
            let coverUrl = coverElement ? Widget.dom.attr(coverElement, "src") : "";
            if (coverUrl && coverUrl.startsWith("//")) { // Handle protocol-relative URLs [1]
                coverUrl = "https:" + coverUrl;
            }

            const rankElement = Widget.dom.selectFirst(elementId, "span.rank");
            const rankText = rankElement ? Widget.dom.text(rankElement) : ""; // e.g., Rank N/A [1]

            const infoElement = Widget.dom.selectFirst(elementId, "p.info.tip");
            const info = infoElement ? Widget.dom.text(infoElement).trim() : "N/A"; // e.g., 12 Episodes / 2023-10-01 [1]

            const ratingElement = Widget.dom.selectFirst(elementId, "small.fade");
            const rating = ratingElement ? Widget.dom.text(ratingElement) : "N/A"; // e.g., 8.1 [1]

            const ratersElement = Widget.dom.selectFirst(elementId, "span.tip_j");
            const raters = ratersElement ? Widget.dom.text(ratersElement) : "N/A"; // e.g., (12345人评分) [1]

            let description = "";
            if (rankText) description += `${rankText.trim()} | `;
            if (rating !== "N/A") description += `评分: ${rating.trim()}`;
            if (raters !== "N/A") description += ` ${raters.trim()} | `; // Space before raters if rating exists
            description += `信息: ${info}`;


            return {
                id: id, // Unique ID, using the numeric ID from Bangumi [1]
                type: "url", // Type for a standard link item
                title: title.trim(), // Title of the anime [1]
                coverUrl: coverUrl, // Cover image URL [1]
                description: description.replace(/\s*\|\s*$/, "").trim(), // Combined description [1]
                url: itemLink, // Full URL to the anime's detail page [1]
            };
        });
    } catch (error) {
        console.error(`处理 ${url} 失败:`, error.message, error.stack);
        if (error.message && (error.message.includes("ENOTFOUND") || error.message.includes("ETIMEOUT") || error.message.includes("ECONNREFUSED"))) {
             throw new Error(`无法访问网络地址 ${url}。请检查网络连接或URL是否正确。`);
        }
        if (error.message && (error.message.includes("404") || error.message.includes("403"))) {
            throw new Error(`访问 ${url} 时发生错误: 服务器返回 ${error.message}。该页面可能不存在或禁止访问。`);
        }
        throw new Error(`获取和处理 ${url} 内容时出错: ${error.message}`);
    }
}
