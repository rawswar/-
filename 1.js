var WidgetMetadata = {
    id: "tv.bgm.anime",
    title: "Bangumi 动画",
    description: "从 bgm.tv 获取动画信息",
    author: "AI Agent",
    site: "https://bgm.tv",
    version: "1.0.1",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "最近热门动画",
            description: "获取最近热门的动画列表",
            requiresWebView: false,
            functionName: "getPopularAnime",
            sectionMode: false,
            params: []
        },
        {
            title: "按年份动画 (排名)",
            description: "获取指定年份的动画列表，按排名排序",
            requiresWebView: false,
            functionName: "getAnimeByYear",
            sectionMode: false,
            params: [
                {
                    name: "year",
                    title: "年份",
                    type: "input",
                    description: "请输入年份 (例如: 2025)",
                    value: new Date().getFullYear().toString() // 默认值为当前年份
                }
            ]
        }
    ]
};

async function getPopularAnime(params = {}) {
    const url = "https://bgm.tv/anime/browser/?sort=trends";
    // 使用 #browserItemList li.item 作为选择器来获取每个动画条目 [1]
    return fetchAndProcessAnimeList(url, "#browserItemList li.item");
}

async function getAnimeByYear(params = {}) {
    if (!params.year || !/^\d{4}$/.test(params.year)) {
        throw new Error("年份参数缺失或格式不正确 (应为4位数字)");
    }
    const year = params.year;
    const url = `https://bgm.tv/anime/browser/airtime/${year}?sort=rank`;
    // 假设此页面的结构与热门动画页面相似 [1]
    // 如果 Widget.http.get 无法访问此 URL (如同之前浏览工具遇到的情况)，此模块可能无法正常工作
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
            return []; // 没有找到条目，返回空数组
        }

        return elements.map(elementId => {
            const titleElement = Widget.dom.selectFirst(elementId, "h3.title a");
            const title = titleElement ? Widget.dom.text(titleElement) : "N/A";
            const itemLinkRelative = titleElement ? Widget.dom.attr(titleElement, "href") : "";
            const itemLink = itemLinkRelative ? "https://bgm.tv" + itemLinkRelative : "";

            // 从链接中提取 ID，例如 /subject/12345 -> 12345 [1]
            const subjectIdMatch = itemLinkRelative.match(/\/subject\/(\d+)/);
            const id = subjectIdMatch ? subjectIdMatch[1] : `bgm_${Math.random().toString(36).substr(2, 9)}`;

            const coverElement = Widget.dom.selectFirst(elementId, "a.ll img");
            let coverUrl = coverElement ? Widget.dom.attr(coverElement, "src") : "";
            if (coverUrl && coverUrl.startsWith("//")) { // [1]
                coverUrl = "https:" + coverUrl;
            }

            const rankElement = Widget.dom.selectFirst(elementId, "span.rank");
            const rankText = rankElement ? Widget.dom.text(rankElement) : ""; // Rank N/A [1]

            const infoElement = Widget.dom.selectFirst(elementId, "p.info.tip");
            const info = infoElement ? Widget.dom.text(infoElement).trim() : "N/A"; // [1]

            const ratingElement = Widget.dom.selectFirst(elementId, "small.fade");
            const rating = ratingElement ? Widget.dom.text(ratingElement) : "N/A"; // [1]

            const ratersElement = Widget.dom.selectFirst(elementId, "span.tip_j");
            const raters = ratersElement ? Widget.dom.text(ratersElement) : "N/A"; // [1]

            let description = "";
            if (rankText) description += `${rankText.trim()} | `;
            if (rating !== "N/A") description += `评分: ${rating.trim()}`;
            if (raters !== "N/A") description += ` (${raters.trim()}) | `;
            description += `信息: ${info}`;


            return {
                id: id, // 唯一ID，使用番剧的数字ID [1]
                type: "url", // 类型，对于普通链接条目使用 "url"
                title: title.trim(), // 标题 [1]
                coverUrl: coverUrl, // 封面图片地址 [1]
                description: description.replace(/\s*\|\s*$/, "").trim(), // 描述信息拼接 [1]
                url: itemLink, // 指向番剧详情页的完整URL [1]
                // 根据 ForwardWidget 文档，还可以有其他字段如:
                // durationText: "...", // 时长文本 (如果可提取)
                // previewUrl: "...", // 预览视频地址 (如果可提取)
            };
        });
    } catch (error) {
        console.error(`处理 ${url} 失败:`, error.message, error.stack);
        if (error.message && error.message.includes("ENOTFOUND") || error.message.includes("ETIMEOUT") || error.message.includes("ECONNREFUSED")) {
             throw new Error(`无法访问网络地址 ${url}。请检查网络连接或URL是否正确。`);
        }
        if (error.message && (error.message.includes("404") || error.message.includes("403"))) {
            throw new Error(`访问 ${url} 时发生错误: 服务器返回 ${error.message}。该页面可能不存在或禁止访问。`);
        }
        throw new Error(`获取和处理 ${url} 内容时出错: ${error.message}`);
    }
}
