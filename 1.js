/**
 * ForwardWidget Script for Bangumi Anime Browser (Sorted by Trends)
 * Version: 1.0.2
 * Author: Your Name/Nickname (Please Replace)
 * Source: https://bgm.tv/anime/browser?sort=trends
 * Description: Fetches and parses the anime list from Bangumi's anime browser page,
 *              sorted by popularity trends. Supports pagination.
 */

// =============================================================================
// I. WIDGET METADATA CONFIGURATION
//    - MUST be the first executable part of the script.
//    - Defines the widget's properties and modules.
// =============================================================================
var WidgetMetadata = {
    // --- Basic Widget Information ---
    id: "bangumi_anime_browser_trends", // Unique identifier (lowercase, underscores)
    title: "Bangumi 动画热度榜",        // Display title in the app
    description: "浏览 Bangumi 按热度排序的动画列表，支持翻页。", // Widget description
    author: "Your Name/Nickname",       // Your identifier (REPLACE THIS)
    site: "https://bgm.tv",             // Primary website URL
    version: "1.0.2",                 // Widget script version
    requiredVersion: "0.0.1",          // Minimum ForwardWidget app version

    // --- Functional Modules ---
    modules: [
        {
            // Module definition for fetching the trend list
            title: "动画热度榜 (分页)",     // Module display title
            description: "按热度顺序显示 Bangumi 动画列表，可选择页码。", // Module description
            requiresWebView: false,    // Use standard HTTP requests (Widget.http)
            functionName: "fetchBangumiAnimeTrends", // EXACT name of the processing function below
            sectionMode: false,        // Standard list output expected
            params: [                  // Parameters for this module
                {
                    name: "page",          // Internal name (used as params.page)
                    title: "页码",         // User-facing label
                    type: "page",          // Use the built-in 'page' parameter type
                    description: "选择要加载的 Bangumi 列表页码", // Help text
                    value: "1"             // Default value is page 1
                }
                // Add other parameters here if needed
            ]
        }
        // Add other modules here if this widget provides more functions
    ]

    // --- Optional Search Configuration ---
    /*
    search: {
        title: "搜索 Bangumi 动画",
        functionName: "searchBangumiAnime", // Name of the search function
        params: [
            { name: "query", title: "关键词", type: "input", value: "", description: "输入搜索关键词" }
        ]
    }
    */
}; // End of WidgetMetadata definition

// =============================================================================
// II. PROCESSING FUNCTION IMPLEMENTATION
//     - Contains the core logic for fetching and parsing data.
//     - Function name MUST match 'functionName' in the corresponding module metadata.
// =============================================================================

/**
 * Fetches anime data from Bangumi based on trends and page number.
 * Corresponds to the 'fetchBangumiAnimeTrends' functionName in metadata.
 *
 * @param {object} params - Object containing parameter values (e.g., { page: "1" }).
 * @returns {Promise<Array<object>>} A Promise resolving to an array of VideoItem objects.
 * @throws {Error} If fetching or parsing fails.
 */
async function fetchBangumiAnimeTrends(params = {}) {
    // Ensure params is an object, default page to "1"
    const safeParams = params || {};
    const page = safeParams.page || "1";
    const baseUrl = "https://bgm.tv";
    let targetUrl = `${baseUrl}/anime/browser/?sort=trends`;

    if (page !== "1") {
        targetUrl += `&page=${page}`;
    }

    // Use console.log for debugging within the app's testing tools
    console.log(`Executing ${WidgetMetadata.id}: Fetching ${targetUrl}`);

    try {
        // 1. --- Send HTTP GET Request ---
        // Use the Widget.http API as specified in the documentation
        const response = await Widget.http.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
                "Referer": `${baseUrl}/`,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
            }
        });

        if (!response || !response.data) {
            throw new Error(`No data received from ${targetUrl}`);
        }

        // 2. --- Parse HTML Response ---
        // Use the Widget.html API (Cheerio) as specified in the documentation
        const $ = Widget.html.load(response.data);

        // 3. --- Extract Data Items ---
        const videoItems = [];
        const itemSelector = 'ul#browserItemList > li.item'; // More specific selector

        $(itemSelector).each((index, element) => {
            const $item = $(element);

            // Extract data using selectors derived from the HTML structure
            const titleAnchor = $item.find('.inner h3 a.l');
            const mainTitle = titleAnchor.text().trim();
            const originalTitle = $item.find('.inner h3 small.grey').text().trim();
            const fullTitle = originalTitle ? `${mainTitle} ${originalTitle}` : mainTitle;

            const coverImg = $item.find('a.subjectCover img.cover');
            let posterPath = coverImg.attr('src');
            if (posterPath && posterPath.startsWith('//')) {
                posterPath = 'https:' + posterPath;
            }

            const detailAnchor = $item.find('a.subjectCover');
            let detailLink = detailAnchor.attr('href');
            if (detailLink && detailLink.startsWith('/')) {
                detailLink = baseUrl + detailLink;
            }

            const itemIdAttr = $item.attr('id');
            const subjectId = itemIdAttr ? itemIdAttr.replace('item_', '') : detailLink; // Use subject ID if possible

            const ratingScore = $item.find('.inner p.rateInfo small.fade').text().trim();
            const infoText = $item.find('.inner p.info.tip').text().trim().replace(/\s\s+/g, ' '); // Clean whitespace

            let releaseDate = "";
            const dateMatch = infoText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
            if (dateMatch && dateMatch[1]) {
                releaseDate = dateMatch[1];
            }

            // 4. --- Format as VideoItem ---
            // Create an object matching the structure specified in the documentation
            const videoItem = {
                id: subjectId || `fallback_${Date.now()}_${index}`, // Ensure ID is always present
                type: "url",               // As per documentation for web-scraped items
                title: fullTitle || "未知标题",
                posterPath: posterPath || "",
                backdropPath: "",          // Usually not available in list view
                releaseDate: releaseDate,
                mediaType: "tv",           // Assuming 'tv' for /anime/ section
                rating: ratingScore || "N/A",
                genreTitle: "",            // Not available directly in the list item
                duration: 0,               // Not available
                durationText: "",          // Not available
                previewUrl: "",            // Not available
                videoUrl: "",              // Not available
                link: detailLink || "",    // Link to the detail page
                description: infoText,     // Use the info line as description
                childItems: []             // No nested items
            };
            videoItems.push(videoItem);
        });

        console.log(`Executing ${WidgetMetadata.id}: Parsed ${videoItems.length} items from page ${page}.`);

        // 5. --- Return Result Array ---
        // The function must return an array of these VideoItem objects
        return videoItems;

    } catch (error) {
        console.error(`Error in ${WidgetMetadata.id} (Page ${page}):`, error);
        // Re-throw the error for the ForwardWidget app to handle
        throw new Error(`[${WidgetMetadata.id}] Failed: ${error.message}`);
    }
}

// Optional: Implement search function if defined in metadata
/*
async function searchBangumiAnime(params = {}) {
    // ... search logic ...
}
*/

