/**
 * ForwardWidget Script for Bangumi Anime Browser (Sorted by Trends)
 * Version: 1.0.3
 * Author: 加个家鸽
 * Source: https://bgm.tv/anime/browser?sort=trends
 * Description: Fetches and parses the anime list from Bangumi's anime browser page,
 *              sorted by popularity trends. Supports pagination. Mimics douban.js structure.
 */

// =============================================================================
// I. WIDGET METADATA CONFIGURATION
//    - Using structure observed in working douban.js example.
// =============================================================================
WidgetMetadata = { // No 'var' keyword
    // --- Basic Info (Part 1) ---
    id: "bangumi_anime_browser_trends",
    title: "Bangumi 动画热度榜",

    // --- Functional Modules ---
    modules: [
        {
            title: "动画热度榜 (分页)",
            description: "按热度顺序显示 Bangumi 动画列表，可选择页码。",
            requiresWebView: false,
            functionName: "fetchBangumiAnimeTrends", // Function name below
            sectionMode: false,
            params: [
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                    description: "选择要加载的 Bangumi 列表页码",
                    value: "1"
                }
            ]
        }
    ], // End of modules array

    // --- Basic Info (Part 2 - Order matches douban.js) ---
    version: "1.0.3",                 // Widget script version
    requiredVersion: "0.0.1",          // Minimum ForwardWidget app version
    description: "浏览 Bangumi 按热度排序的动画列表，支持翻页。", // Widget description (repeated for structure match)
    author: "Your Name/Nickname",       // Your identifier (REPLACE THIS)
    site: "https://bgm.tv"              // Primary website URL

    // Optional Search config could go here if needed
}; // End of WidgetMetadata definition

// =============================================================================
// II. PROCESSING FUNCTION IMPLEMENTATION
//     - Using Widget.dom API to match douban.js example.
// =============================================================================

/**
 * Fetches anime data from Bangumi based on trends and page number.
 *
 * @param {object} params - Object containing parameter values (e.g., { page: "1" }).
 * @returns {Promise<Array<object>>} A Promise resolving to an array of VideoItem objects.
 * @throws {Error} If fetching or parsing fails.
 */
async function fetchBangumiAnimeTrends(params = {}) {
    const safeParams = params || {};
    const page = safeParams.page || "1";
    const baseUrl = "https://bgm.tv";
    let targetUrl = `${baseUrl}/anime/browser/?sort=trends`;

    if (page !== "1") {
        targetUrl += `&page=${page}`;
    }

    console.log(`Executing ${WidgetMetadata.id} v${WidgetMetadata.version}: Fetching ${targetUrl}`);

    try {
        // 1. --- Send HTTP GET Request ---
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

        // 2. --- Parse HTML Response using Widget.dom ---
        const docId = Widget.dom.parse(response.data);
        if (docId < 0) {
            // Check if parsing failed (Widget.dom.parse returns negative on failure)
            throw new Error("Failed to parse HTML document.");
        }
        console.log(`HTML parsed successfully (docId: ${docId})`);

        // 3. --- Select Element IDs ---
        // Select the container for each list item
        const itemContainerSelector = 'ul#browserItemList > li.item';
        const itemElementIds = Widget.dom.select(docId, itemContainerSelector);
        console.log(`Found ${itemElementIds.length} item containers.`);

        // 4. --- Extract Data for Each Item ---
        const videoItems = [];
        for (const itemId of itemElementIds) {
            try {
                // Extract data relative to the current item container (itemId)
                const titleAnchorId = Widget.dom.select(itemId, '.inner h3 a.l')[0];
                const mainTitle = titleAnchorId >= 0 ? await Widget.dom.text(titleAnchorId) : "";

                const originalTitleSmallId = Widget.dom.select(itemId, '.inner h3 small.grey')[0];
                const originalTitle = originalTitleSmallId >= 0 ? await Widget.dom.text(originalTitleSmallId) : "";
                const fullTitle = originalTitle ? `${mainTitle.trim()} ${originalTitle.trim()}` : mainTitle.trim();

                const coverImgId = Widget.dom.select(itemId, 'a.subjectCover img.cover')[0];
                let posterPath = coverImgId >= 0 ? await Widget.dom.attr(coverImgId, 'src') : "";
                if (posterPath && posterPath.startsWith('//')) {
                    posterPath = 'https:' + posterPath;
                }

                const detailAnchorId = Widget.dom.select(itemId, 'a.subjectCover')[0];
                let detailLink = detailAnchorId >= 0 ? await Widget.dom.attr(detailAnchorId, 'href') : "";
                if (detailLink && detailLink.startsWith('/')) {
                    detailLink = baseUrl + detailLink;
                }

                // Get subject ID from the container's 'id' attribute
                const itemIdAttr = await Widget.dom.attr(itemId, 'id'); // e.g., "item_363957"
                const subjectId = itemIdAttr ? itemIdAttr.replace('item_', '') : detailLink; // Fallback

                const ratingSmallId = Widget.dom.select(itemId, '.inner p.rateInfo small.fade')[0];
                const ratingScore = ratingSmallId >= 0 ? (await Widget.dom.text(ratingSmallId)).trim() : "N/A";

                const infoPId = Widget.dom.select(itemId, '.inner p.info.tip')[0];
                const infoText = infoPId >= 0 ? (await Widget.dom.text(infoPId)).trim().replace(/\s\s+/g, ' ') : "";

                let releaseDate = "";
                const dateMatch = infoText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
                if (dateMatch && dateMatch[1]) {
                    releaseDate = dateMatch[1];
                }

                // 5. --- Format as VideoItem ---
                const videoItem = {
                    id: subjectId || `fallback_${Date.now()}_${videoItems.length}`,
                    type: "url",
                    title: fullTitle || "未知标题",
                    posterPath: posterPath || "",
                    backdropPath: "",
                    releaseDate: releaseDate,
                    mediaType: "tv",
                    rating: ratingScore,
                    genreTitle: "",
                    duration: 0,
                    durationText: "",
                    previewUrl: "",
                    videoUrl: "",
                    link: detailLink || "",
                    description: infoText,
                    childItems: []
                };
                videoItems.push(videoItem);

            } catch(innerError) {
                console.error(`Error processing item with ID ${itemId}:`, innerError);
                // Skip this item and continue with the next
            }
        } // End of loop through items

        console.log(`Executing ${WidgetMetadata.id}: Successfully processed ${videoItems.length} items from page ${page}.`);

        // 6. --- Return Result Array ---
        return videoItems;

    } catch (error) {
        console.error(`Error in ${WidgetMetadata.id} (Page ${page}):`, error);
        throw new Error(`[${WidgetMetadata.id}] Failed: ${error.message}`);
    } finally {
        // Optional: Release the parsed document if Widget.dom requires manual cleanup
        // if (docId >= 0) { Widget.dom.release(docId); }
    }
}

// Optional: Implement search function if defined in metadata
/*
async function searchBangumiAnime(params = {}) {
    // ... search logic ...
}
*/
