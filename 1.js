/**
 * ForwardWidget Script for Bangumi Anime Browser (Sorted by Trends)
 *
 * Fetches and parses the anime list from Bangumi's anime browser page (bgm.tv),
 * sorted by popularity trends. Supports pagination.
 */

// I. Widget Metadata Configuration (Must be the first part of the script)
var WidgetMetadata = {
    id: "bangumi_anime_browser_trends", // Unique ID (e.g., lowercase_with_underscores)
    title: "Bangumi 动画热度榜",        // Human-readable title for the widget
    description: "浏览 Bangumi 按热度排序的动画列表，支持翻页。", // Description shown in the app
    author: "Your Name/Nickname",       // Your identifier (Please replace!)
    site: "https://bgm.tv/anime/browser?sort=trends", // The primary website this widget interacts with
    version: "1.0.1",                 // Version of this widget script (increment if you make changes)
    requiredVersion: "0.0.1",          // Minimum ForwardWidget app version needed
    modules: [                         // Array of functional modules this widget provides
        {
            title: "动画热度榜 (分页)",     // Title for this specific function/module
            description: "按热度顺序显示 Bangumi 动画列表，可选择页码。", // Description for this module
            requiresWebView: false,    // false: Uses Widget.http for requests. true: Might need a WebView environment.
            functionName: "fetchBangumiAnimeTrends", // The EXACT name of the JavaScript function to call
            sectionMode: false,        // false: Standard list output. true: Might be for sectioned results.
            params: [                  // Array of parameters this module accepts
                {
                    name: "page",          // Internal parameter name used in the function (params.page)
                    title: "页码",         // Label shown to the user for this parameter
                    type: "page",          // Parameter type: 'page' provides a page number input/selector
                    description: "选择要加载的 Bangumi 列表页码", // Helper text for the user
                    value: "1"             // Default value for the parameter if not provided
                }
                // Add more parameters here if needed in the future
            ]
        }
    ]
    // Optional 'search' configuration can be added here later if needed
    /*
    search: {
        title: "搜索 Bangumi 动画",
        functionName: "searchBangumiAnime",
        params: [
            { name: "query", title: "关键词", type: "input", value: "" }
        ]
    }
    */
}; // IMPORTANT: Ensure the metadata object definition ends with a semicolon.

// II. Processing Function Implementation
/**
 * Fetches anime data from Bangumi's browser page based on trends and page number.
 * This function name MUST match the 'functionName' specified in WidgetMetadata.modules.
 *
 * @param {object} params - An object containing parameter values passed from the widget interface.
 *                          Example: { page: "2" }
 * @returns {Promise<Array<object>>} A Promise that resolves to an array of VideoItem objects
 *                                   conforming to the ForwardWidget data model.
 * @throws {Error} Throws an error if the request or parsing fails.
 */
async function fetchBangumiAnimeTrends(params = {}) {
    // Default to page 1 if not provided or invalid
    const page = params && params.page ? params.page : "1";
    const baseUrl = "https://bgm.tv";
    let targetUrl = `${baseUrl}/anime/browser/?sort=trends`;

    // Append page parameter if it's not the first page
    if (page !== "1") {
        targetUrl += `&page=${page}`;
    }

    console.log(`[${WidgetMetadata.id}] Fetching URL: ${targetUrl}`);

    try {
        // 1. Perform HTTP GET Request
        const response = await Widget.http.get(targetUrl, {
            headers: {
                // Using a common browser User-Agent is often necessary
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
                "Referer": `${baseUrl}/`, // Sending a Referer can sometimes help
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" // Optional: Specify language preference
            }
        });

        // Check if the request was successful and returned data
        if (!response || !response.data) {
            throw new Error(`HTTP request failed or returned no data for ${targetUrl}`);
        }

        // 2. Parse the HTML Content
        // Use Widget.html.load() which provides a Cheerio-like interface
        const $ = Widget.html.load(response.data);

        // 3. Extract Data Items
        const videoItems = [];
        const listSelector = 'ul#browserItemList li.item'; // Selector for each anime item container

        $(listSelector).each((index, element) => {
            const $item = $(element); // Wrap the current element with Cheerio

            // --- Extract individual pieces of data using specific selectors ---

            // Title (Main and Original)
            const titleAnchor = $item.find('.inner h3 a.l');
            const mainTitle = titleAnchor.text().trim();
            const originalTitle = $item.find('.inner h3 small.grey').text().trim();
            const fullTitle = originalTitle ? `${mainTitle} ${originalTitle}` : mainTitle;

            // Cover Image URL
            const coverImg = $item.find('a.subjectCover img.cover');
            let posterPath = coverImg.attr('src');
            if (posterPath && posterPath.startsWith('//')) {
                posterPath = 'https:' + posterPath; // Ensure URL has protocol
            }

            // Detail Page Link
            const detailAnchor = $item.find('a.subjectCover'); // Link is usually on the cover
            let detailLink = detailAnchor.attr('href');
            if (detailLink && detailLink.startsWith('/')) {
                detailLink = baseUrl + detailLink; // Ensure URL is absolute
            }

            // Bangumi Subject ID (extracted from the list item's ID attribute)
            const itemIdAttr = $item.attr('id'); // e.g., "item_363957"
            const subjectId = itemIdAttr ? itemIdAttr.replace('item_', '') : detailLink; // Use link as fallback ID

            // Rating Score
            const ratingScore = $item.find('.inner p.rateInfo small.fade').text().trim();

            // Info Text (contains release date, episodes, etc.)
            const infoText = $item.find('.inner p.info.tip').text().trim().replace(/\s+/g, ' ');

            // Attempt to extract Release Date from infoText
            let releaseDate = "";
            const dateRegex = /(\d{4}年\d{1,2}月\d{1,2}日)/;
            const dateMatch = infoText.match(dateRegex);
            if (dateMatch && dateMatch[1]) {
                releaseDate = dateMatch[1]; // Format: YYYY年MM月DD日
            }

            // --- Map extracted data to the VideoItem structure ---
            const videoItem = {
                // Required fields (ensure these have values)
                id: subjectId || `bgm_${Date.now()}_${index}`, // Use subjectId, fallback to unique generated ID
                type: "url",               // Type for items identified by URL/web source
                title: fullTitle || "未知标题", // Provide a fallback title

                // Optional fields (provide if available, otherwise use defaults)
                posterPath: posterPath || "",     // Vertical cover URL
                backdropPath: "",          // Horizontal cover (usually unavailable in list)
                releaseDate: releaseDate,  // Extracted date string
                mediaType: "tv",           // Assume 'tv' for Bangumi anime section
                rating: ratingScore || "0",// Rating string
                genreTitle: "",            // Genre (unavailable in list item)
                duration: 0,               // Duration in seconds (unavailable)
                durationText: "",          // Duration as text (unavailable)
                previewUrl: "",            // Preview video URL (unavailable)
                videoUrl: "",              // Direct video play URL (unavailable)
                link: detailLink || "",    // Link to the detail page on Bangumi
                description: infoText,     // Use the info line as description
                childItems: []             // No nested items expected here
            };

            videoItems.push(videoItem);
        });

        console.log(`[${WidgetMetadata.id}] Parsed ${videoItems.length} items from page ${page}.`);

        // 4. Return the result array
        return videoItems;

    } catch (error) {
        // Log the error with widget ID for easier debugging
        console.error(`[${WidgetMetadata.id}] Error processing page ${page}:`, error.message);
        // It's important to re-throw the error so the ForwardWidget app knows something went wrong.
        throw new Error(`[${WidgetMetadata.id}] Failed to fetch or parse Bangumi data: ${error.message}`);
    }
}

// Optional: Implement the search function if you defined it in metadata
/*
async function searchBangumiAnime(params = {}) {
    const query = params.query;
    if (!query) return [];
    // ... implementation for searching ...
    console.log(`Searching for: ${query}`);
    return []; // Placeholder
}
*/
