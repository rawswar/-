// Defines the metadata for the Bangumi Anime Widget
WidgetMetadata = {
  id: "bgm_anime", // Unique ID for this widget
  title: "Bangumi 动画", // Title of the widget
  description: "从 bgm.tv 获取最近热门及按年份排序的动画列表。", // Description of the widget
  author: "AI Agent (User Editable)", // Your name or alias
  site: "https://bgm.tv", // The primary data source website, or your widget's GitHub repo URL
  version: "1.0.0", // Version of your widget
  requiredVersion: "0.0.1", // Minimum ForwardWidgets version required (usually "0.0.1")
  modules: [
    {
      title: "最近热门动画", // Title of the first module
      requiresWebView: false, // Typically false if no web login/interaction is needed within the widget
      functionName: "getPopularAnime", // JS function to call for this module
      params: [] // No parameters for this module
    },
    {
      title: "按年份动画 (排名)", // Title of the second module
      requiresWebView: false,
      functionName: "getAnimeByYear", // JS function to call for this module
      params: [
        {
          name: "year", // Internal parameter name
          title: "年份", // Display name for the parameter
          type: "input", // Type of input
          description: "请输入4位数字年份 (例如: 2025)",
          value: (new Date().getFullYear()).toString() // Default value (current year)
        }
      ]
    }
  ]
};

// --- JavaScript Functions for the Widget ---

/**
 * Fetches and processes a list of anime from a given Bangumi URL and item selector.
 * @param {string} url The URL to fetch anime from.
 * @param {string} itemSelector The CSS selector for individual anime items.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of anime objects.
 */
async function fetchAndProcessAnimeList(url, itemSelector) {
    try {
        console.log(`Bangumi Widget: Fetching URL: ${url}`);
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ForwardWidget/1.0"
            }
        });

        if (!response || !response.data) {
            console.error(`Bangumi Widget: No data received from ${url}`);
            throw new Error("未能获取到有效的页面数据。");
        }

        const docId = Widget.dom.parse(response.data);
        if (!docId) {
            console.error(`Bangumi Widget: HTML parsing failed for ${url}`);
            throw new Error("HTML 解析失败。");
        }

        const elements = Widget.dom.select(docId, itemSelector);
        if (!elements || elements.length === 0) {
            console.log(`Bangumi Widget: No elements found with selector "${itemSelector}" on page: ${url}`);
            return []; // No items found, return empty array
        }

        console.log(`Bangumi Widget: Found ${elements.length} items from ${url}`);

        return elements.map(elementId => {
            const titleElement = Widget.dom.selectFirst(elementId, "h3.title a");
            const title = titleElement ? Widget.dom.text(titleElement) : "N/A";
            const itemLinkRelative = titleElement ? Widget.dom.attr(titleElement, "href") : "";
            const itemLink = itemLinkRelative ? "https://bgm.tv" + itemLinkRelative : "";

            const subjectIdMatch = itemLinkRelative.match(/\/subject\/(\d+)/);
            const id = subjectIdMatch ? subjectIdMatch[1] : `bgm_${Math.random().toString(36).substr(2, 9)}`; // Use Bangumi subject ID if available

            const coverElement = Widget.dom.selectFirst(elementId, "a.ll img");
            let coverUrl = coverElement ? Widget.dom.attr(coverElement, "src") : "";
            if (coverUrl && coverUrl.startsWith("//")) {
                coverUrl = "https:" + coverUrl; // Ensure protocol for cover URL
            }

            const rankElement = Widget.dom.selectFirst(elementId, "span.rank");
            const rankText = rankElement ? Widget.dom.text(rankElement).trim() : "";

            const infoElement = Widget.dom.selectFirst(elementId, "p.info.tip");
            const info = infoElement ? Widget.dom.text(infoElement).trim() : "N/A";

            const ratingElement = Widget.dom.selectFirst(elementId, "small.fade");
            const rating = ratingElement ? Widget.dom.text(ratingElement).trim() : "N/A";

            const ratersElement = Widget.dom.selectFirst(elementId, "span.tip_j");
            const raters = ratersElement ? Widget.dom.text(ratersElement).trim() : ""; // e.g., (12345人评分)

            let descriptionParts = [];
            if (rankText && rankText !== "Rank N/A") descriptionParts.push(rankText); // Add rank if available and not "N/A"
            if (rating !== "N/A") descriptionParts.push(`评分: ${rating} ${raters}`);
            descriptionParts.push(info);

            return {
                id: id,
                type: "url", // General type for URL-based items
                title: title.trim(),
                coverUrl: coverUrl || "", // Provide empty string if no cover
                description: descriptionParts.join(' | ').trim(),
                url: itemLink,
                // You could add more fields here if needed, e.g., for specific handling by the app
                // mediaType: "anime" // If the app uses such a field
            };
        });
    } catch (error) {
        console.error(`Bangumi Widget: Error in fetchAndProcessAnimeList for ${url}:`, error.message, error.stack);
        // More specific error messages can be helpful
        if (error.message && (error.message.includes("ENOTFOUND") || error.message.includes("ETIMEOUT") || error.message.includes("ECONNREFUSED"))) {
             throw new Error(`网络错误: 无法访问 ${url}。请检查网络连接或URL。`);
        }
        if (error.message && (error.message.includes("404") || error.message.includes("403"))) {
            throw new Error(`访问错误: 服务器返回 ${error.message} 访问 ${url}。页面可能不存在或禁止访问。`);
        }
        throw new Error(`处理 ${url} 内容时出错: ${error.message}`);
    }
}

/**
 * Fetches popular anime from Bangumi.
 * @param {Object} params Parameters (not used in this function).
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of popular anime objects.
 */
async function getPopularAnime(params = {}) {
    console.log("Bangumi Widget: Getting popular anime...");
    const url = "https://bgm.tv/anime/browser/?sort=trends";
    // CSS selector for items on the "trends" page. [1]
    return fetchAndProcessAnimeList(url, "#browserItemList li.item");
}

/**
 * Fetches anime from a specific year, sorted by rank, from Bangumi.
 * @param {Object} params Parameters object. Expected to have a 'year' property.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of anime objects for the specified year.
 */
async function getAnimeByYear(params = {}) {
    const year = params.year || (new Date().getFullYear()).toString(); // Default to current year if not provided
    console.log(`Bangumi Widget: Getting anime for year ${year}...`);

    if (!/^\d{4}$/.test(year)) {
        console.error("Bangumi Widget: Invalid year format provided:", year);
        throw new Error("年份参数格式不正确 (应为4位数字, 例如: 2025)");
    }
    const url = `https://bgm.tv/anime/browser/airtime/${year}?sort=rank`;
    // CSS selector for items on the "by year" page, assuming it's the same. [1]
    return fetchAndProcessAnimeList(url, "#browserItemList li.item");
}
