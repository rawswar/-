// Defines the metadata for the Bangumi Anime Widget
WidgetMetadata = {
  id: "bgm.bgm.anime", // Changed ID again to ensure it's seen as new
  title: "Bangumi 动画",
  description: "从 bgm.tv 获取动画列表 (热门/按年份)",
  author: "AI Agent", // <<<< Please change this
  site: "https://bgm.tv",
  version: "1.0.1",
  requiredVersion: "0.0.1", // Assuming this is standard
  modules: [
    {
      title: "最近热门动画",
      requiresWebView: false, // Standard if no login needed inside widget
      functionName: "getPopularAnime", // JS function to call
      params: [] // No parameters for this module
    },
    {
      title: "按年份动画 (排名)",
      requiresWebView: false,
      functionName: "getAnimeByYear",
      // Parameter definition - closely modeled on the Douban 'input' and 'enumeration' examples
      params: [
        {
          name: "year", // Internal name for the parameter
          title: "年份",  // Label displayed in UI
          type: "input",  // For a text input field
          description: "输入4位数字年份 (例如: " + new Date().getFullYear() + ")",
          // 'value' for input type often acts as initial text,
          // but placeholders might be preferred by some apps.
          // Let's try with 'value' first for simplicity if placeholders didn't work.
          value: (new Date().getFullYear()).toString(),
          // 'placeholders' from your Douban example provided quick options.
          // If 'value' doesn't work, or if 'input' still doesn't show,
          // then the issue might be deeper in how your FW app handles 'input' type.
          // For now, keeping it simple. If this "input" type does not show up at all,
          // then "enumeration" is the fallback.
        }
        /*
        // Alternative: Year as a dropdown if "input" type consistently fails to appear
        // To use this, comment out the 'input' type param above and uncomment this block.
        {
          name: "year",
          title: "选择年份",
          type: "enumeration", // Dropdown
          description: "选择动画播出的年份进行查询",
          value: (new Date().getFullYear()).toString(), // Default selected
          enumOptions: [
            { title: String(new Date().getFullYear()),     value: String(new Date().getFullYear()) },
            { title: String(new Date().getFullYear() - 1), value: String(new Date().getFullYear() - 1) },
            { title: String(new Date().getFullYear() - 2), value: String(new Date().getFullYear() - 2) },
            { title: String(new Date().getFullYear() - 3), value: String(new Date().getFullYear() - 3) },
            { title: "2020", value: "2020" },
            { title: "2019", value: "2019" }
            // Add more years
          ]
        }
        */
      ]
    }
  ]
};

// --- JavaScript Functions ---

async function fetchAndProcessAnimeList(url, itemSelector) {
    try {
        console.log(`Bangumi Widget: Attempting to fetch URL: ${url}`);
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 ForwardWidget/1.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8", // Prioritize Chinese
                "Connection": "keep-alive"
            }
        });

        if (!response || typeof response.data !== 'string') {
            console.error(`Bangumi Widget: No valid data string received from ${url}. Status: ${response ? response.status : 'N/A'}. Response type: ${typeof response.data}`);
            throw new Error("未能获取到有效的页面数据。服务器返回的数据格式不正确。");
        }

        if (response.status && (response.status < 200 || response.status >= 300)) {
            console.error(`Bangumi Widget: HTTP error ${response.status} for ${url}. Data: ${response.data.substring(0, 200)}`);
            throw new Error(`服务器错误 (状态码: ${response.status}) 访问 ${url}。`);
        }
        console.log(`Bangumi Widget: Successfully fetched data from ${url}. Length: ${response.data.length}`);

        const docId = Widget.dom.parse(response.data);
        if (!docId) {
            console.error(`Bangumi Widget: HTML parsing failed for ${url}. Data (first 500 chars): ${response.data.substring(0, 500)}`);
            throw new Error("HTML 解析失败。收到的内容可能不是有效的HTML。");
        }
        console.log(`Bangumi Widget: HTML parsed successfully for ${url}. DocID: ${docId}`);

        const elements = Widget.dom.select(docId, itemSelector);
        if (!elements || elements.length === 0) {
            console.warn(`Bangumi Widget: No elements found with selector "${itemSelector}" on page: ${url}. The page structure might have changed or the selector is incorrect.`);
            return []; // Return empty if no items, this is not an error in itself
        }
        console.log(`Bangumi Widget: Found ${elements.length} items using selector "${itemSelector}".`);

        return elements.map((elementId, index) => {
            // console.log(`Bangumi Widget: Processing item ${index + 1}`);
            const titleElement = Widget.dom.selectFirst(elementId, "div.inner h3 a.l");
            const title = titleElement ? Widget.dom.text(titleElement).trim() : "无标题";

            const originalTitleElement = Widget.dom.selectFirst(elementId, "div.inner h3 small.grey");
            const originalTitle = originalTitleElement ? Widget.dom.text(originalTitleElement).trim() : "";

            const itemLinkRelative = titleElement ? Widget.dom.attr(titleElement, "href") : "";
            const itemLink = itemLinkRelative ? "https://bgm.tv" + itemLinkRelative : "#"; // Fallback URL

            const subjectIdMatch = itemLinkRelative.match(/\/subject\/(\d+)/);
            // Create a unique ID for the widget item
            const id = subjectIdMatch ? `bgm_subject_${subjectIdMatch[1]}_${index}` : `bgm_random_${new Date().getTime()}_${index}`;

            const coverElement = Widget.dom.selectFirst(elementId, "a.subjectCover img.cover");
            let coverUrl = coverElement ? Widget.dom.attr(coverElement, "src") : "";
            if (coverUrl && coverUrl.startsWith("//")) {
                coverUrl = "https:" + coverUrl;
            }

            const rankElement = Widget.dom.selectFirst(elementId, "div.inner span.rank");
            let rankText = "";
            if (rankElement) {
                const fullRankText = Widget.dom.text(rankElement).trim(); // "Rank 123" or "Rank N/A"
                const rankMatch = fullRankText.match(/Rank\s*(\d+|N\/A)/i);
                if (rankMatch && rankMatch[1] && rankMatch[1].toLowerCase() !== 'n/a') {
                    rankText = `Rank ${rankMatch[1]}`;
                }
            }

            const infoElement = Widget.dom.selectFirst(elementId, "div.inner p.info.tip");
            const info = infoElement ? Widget.dom.text(infoElement).trim() : "";

            const ratingElement = Widget.dom.selectFirst(elementId, "p.rateInfo small.fade");
            const rating = ratingElement ? Widget.dom.text(ratingElement).trim() : "";

            const ratersElement = Widget.dom.selectFirst(elementId, "p.rateInfo span.tip_j");
            const raters = ratersElement ? Widget.dom.text(ratersElement).trim() : ""; // e.g., (12345人评分)

            let descriptionParts = [];
            if (originalTitle) descriptionParts.push(originalTitle);
            if (rankText) descriptionParts.push(rankText);
            if (rating) descriptionParts.push(`评分: ${rating} ${raters}`);
            descriptionParts.push(info); // Info usually contains episode count, date, staff

            // Construct the final item object
            const item = {
                id: id,
                type: "url", // Standard type for items that link to a URL
                title: title,
                coverUrl: coverUrl || "", // Ensure not null
                description: descriptionParts.filter(p => p).join(' | ').trim() || "无描述信息",
                url: itemLink,
                subtitle: info || originalTitle // Subtitle can be a secondary piece of info
            };
            // console.log("Bangumi Widget: Processed item:", JSON.stringify(item));
            return item;
        });
    } catch (error) {
        // Log the error with more details if possible
        console.error(`Bangumi Widget: CRITICAL error in fetchAndProcessAnimeList for URL "${url}". Selector: "${itemSelector}". Error: ${error.message}`, error.stack, error);
        // It's important that the function re-throws or returns an error indication
        // that the calling ForwardWidgets framework can handle, e.g., by showing an error message to the user.
        // Depending on the framework, re-throwing might be the best.
        throw new Error(`处理 ${url} 时发生严重错误: ${error.message}`);
    }
}

async function getPopularAnime(params = {}) {
    console.log("Bangumi Widget: getPopularAnime called. Params:", params);
    const url = "https://bgm.tv/anime/browser/?sort=trends";
    const itemSelector = "#browserItemList li.item"; // From your provided HTML
    return await fetchAndProcessAnimeList(url, itemSelector);
}

async function getAnimeByYear(params = {}) {
    console.log("Bangumi Widget: getAnimeByYear called. Params:", params);
    const year = params.year; // This comes from the 'name' in the params definition

    if (!year || !/^\d{4}$/.test(year)) {
        const errorMsg = `年份参数 "${year}" 无效或缺失。请在上方输入或选择一个有效的4位年份。`;
        console.error("Bangumi Widget: " + errorMsg);
        throw new Error(errorMsg); // This error should be displayed to the user
    }

    const url = `https://bgm.tv/anime/browser/airtime/${year}?sort=rank`;
    const itemSelector = "#browserItemList li.item"; // From your provided HTML
    return await fetchAndProcessAnimeList(url, itemSelector);
}
