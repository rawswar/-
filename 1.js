/**
 * ForwardWidget Script for Bangumi Anime Browser (Sorted by Trends)
 *
 * Fetches and parses the anime list from Bangumi's anime browser page,
 * sorted by popularity trends. Supports pagination.
 */

var WidgetMetadata = {
    id: "bangumi_anime_browser_trends", // Unique ID for this widget
    title: "Bangumi 动画热度榜",        // Widget title displayed in the app
    description: "浏览 Bangumi 按热度排序的动画列表", // Widget description
    author: "Your Name/Nickname",       // Your name or nickname
    site: "https://bgm.tv/anime/browser?sort=trends", // Source website
    version: "1.0.0",                 // Widget version
    requiredVersion: "0.0.1",          // Minimum ForwardWidget version required
    modules: [
        {
            title: "动画热度榜",             // Module title
            description: "显示 Bangumi 按热度排序的动画", // Module description
            requiresWebView: false,        // Standard HTTP request is sufficient
            functionName: "getBangumiAnimeTrends", // Name of the processing function
            sectionMode: false,            // Not using section mode
            params: [
                {
                    name: "page",          // Parameter name for pagination
                    title: "页码",         // Parameter title
                    type: "page",          // Use the built-in 'page' type selector
                    description: "选择要加载的列表页码", // Parameter description
                    value: "1"             // Default value is page 1
                }
            ]
        }
    ],
    // Optional: Add search functionality later if needed
    // search: {
    //     title: "Search Anime",
    //     functionName: "searchAnimeOnBangumi",
    //     params: [/* Search parameters */]
    // }
};

/**
 * Processing function to fetch and parse Bangumi anime trends.
 * @param {object} params - Parameters object, contains { page: "1" } by default.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of VideoItem objects.
 */
async function getBangumiAnimeTrends(params = {}) {
    const page = params.page || "1"; // Get page number from params, default to 1
    let url = `https://bgm.tv/anime/browser/?sort=trends`;
    if (page && page !== "1") {
        url += `&page=${page}`;
    }

    console.log(`Fetching Bangumi Anime Trends: ${url}`);

    try {
        // 1. Send HTTP GET request
        const response = await Widget.http.get(url, {
            headers: {
                // Mimic a browser User-Agent
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": "https://bgm.tv/" // Good practice to include referer
            }
        });

        if (!response || !response.data) {
            throw new Error("未能获取网页内容或响应为空");
        }

        // 2. Parse HTML response using built-in cheerio
        const $ = Widget.html.load(response.data);

        // 3. Select list items and extract data
        const results = [];
        $('ul#browserItemList li.item').each((index, element) => {
            const $item = $(element);

            // Extract data using CSS selectors based on the provided HTML
            const titleElement = $item.find('.inner h3 a.l');
            const mainTitle = titleElement.text().trim();
            const originalTitle = $item.find('.inner h3 small.grey').text().trim();
            const fullTitle = originalTitle ? `${mainTitle} ${originalTitle}` : mainTitle;

            const coverElement = $item.find('a.subjectCover img.cover');
            let coverUrl = coverElement.attr('src');
            // Handle protocol-relative URLs (starting with //)
            if (coverUrl && coverUrl.startsWith('//')) {
                coverUrl = 'https:' + coverUrl;
            }

            const linkElement = $item.find('a.subjectCover');
            let detailLink = linkElement.attr('href');
            // Prepend base URL if the link is relative
            if (detailLink && detailLink.startsWith('/')) {
                detailLink = 'https://bgm.tv' + detailLink;
            }

            // Extract Subject ID from the list item's ID (e.g., "item_363957" -> "363957")
            const itemIdAttr = $item.attr('id');
            const subjectId = itemIdAttr ? itemIdAttr.replace('item_', '') : detailLink; // Fallback to link if ID not found

            const ratingElement = $item.find('.inner p.rateInfo small.fade');
            const rating = ratingElement.text().trim();

            const infoElement = $item.find('.inner p.info.tip');
            const infoText = infoElement.text().trim().replace(/\s+/g, ' '); // Clean up whitespace

            // Attempt to extract release date from info text (e.g., "2025年4月7日")
            let releaseDate = "";
            const dateMatch = infoText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
            if (dateMatch && dateMatch[1]) {
                releaseDate = dateMatch[1];
            }

            // Map extracted data to ForwardWidget VideoItem format
            const videoItem = {
                id: subjectId,              // Use Bangumi subject ID as unique ID
                type: "url",                // Type indicating it's from a general URL source
                title: fullTitle,           // Combined title
                posterPath: coverUrl,       // Vertical cover image URL
                backdropPath: "",           // Horizontal cover usually not available in list view
                releaseDate: releaseDate,   // Extracted release date
                mediaType: "tv",            // Assume 'tv' for anime category on Bangumi
                rating: rating,             // Rating score
                genreTitle: "",             // Genre not directly available per item here
                duration: 0,                // Duration not available here
                durationText: "",           // Duration text not available here
                previewUrl: "",             // Preview video not available
                videoUrl: "",               // Direct video URL not available
                link: detailLink,           // Link to the detail page
                description: infoText,      // Raw info line as description
                childItems: []              // No nested items in this list
            };

            results.push(videoItem);
        });

        console.log(`Successfully parsed ${results.length} items from page ${page}.`);
        // 4. Return the array of VideoItem objects
        return results;

    } catch (error) {
        console.error(`处理 Bangumi 动画热度榜失败 (页码 ${page}):`, error);
        // Rethrow the error so ForwardWidget can handle it (e.g., show an error message)
        throw error;
    }
}

// Optional: Implement search function if needed
// async function searchAnimeOnBangumi(params = {}) { ... }
