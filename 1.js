// ==ForwardWidget==
var WidgetMetadata = {
    id: "trends-imdb-bangumi-v1", // Unique identifier for the widget
    title: "IMDb & Bangumi Trends", // Display title
    description: "Fetches trending Movies/TV Shows from IMDb charts and trending Anime from Bangumi.", // Widget description
    author: "CCE v2.7", // Author name
    site: "https://github.com/CognitiveCatalystEngine", // Author/support website
    version: "1.0.0", // Widget version
    requiredVersion: "0.0.1", // Minimum ForwardWidget version required
    modules: [
        {
            title: "IMDb Trending", // Module title
            description: "Fetches MovieMeter or TVMeter trending lists from IMDb.", // Module description
            requiresWebView: false, // Does not require WebView
            functionName: "getImdbTrending", // Processing function name
            sectionMode: false, // Does not support section mode
            params: [
                {
                    name: "contentType",
                    title: "Content Type",
                    type: "enumeration", // Enumeration type
                    description: "Select the type of content to fetch",
                    value: "movies", // Default value
                    enumOptions: [ // Options for enumeration
                        { title: "Movies", value: "movies" },
                        { title: "TV Shows", value: "tv" },
                        { title: "Mixed (Movies & TV)", value: "mixed" }
                    ]
                },
                {
                    name: "maxResults",
                    title: "Max Results",
                    type: "count", // Count type
                    description: "Maximum number of results to return (0 for all)",
                    value: "25" // Default value
                }
            ]
        },
        {
            title: "Bangumi Anime Trends", // Module title
            description: "Fetches the current trending anime list from Bangumi.", // Module description
            requiresWebView: false, // Does not require WebView
            functionName: "getBangumiTrends", // Processing function name
            sectionMode: false, // Does not support section mode
            params: [
                 {
                    name: "maxResults",
                    title: "Max Results",
                    type: "count", // Count type
                    description: "Maximum number of results to return (0 for all)",
                    value: "25" // Default value
                }
            ]
        }
    ]
    // Optional: Add a search module if needed later
    // search: { ... }
};
// ==/ForwardWidget==

// --- Helper Functions ---

/**
 * Safely extracts text from a selected element.
 * @param {string} docId - The document ID from Widget.dom.parse.
 * @param {string} parentElementId - The ID of the parent element containing the target.
 * @param {string} selector - The CSS selector for the target element.
 * @returns {string} The text content or an empty string if not found/error.
 */
function safeGetText(docId, parentElementId, selector) {
    try {
        const element = Widget.dom.selectFirst(docId, selector, parentElementId);
        return element ? Widget.dom.text(element.id) : "";
    } catch (e) {
        // console.error(`Error getting text for selector "${selector}":`, e);
        return "";
    }
}

/**
 * Safely extracts an attribute from a selected element.
 * @param {string} docId - The document ID from Widget.dom.parse.
 * @param {string} parentElementId - The ID of the parent element containing the target.
 * @param {string} selector - The CSS selector for the target element.
 * @param {string} attributeName - The name of the attribute to extract.
 * @returns {string} The attribute value or an empty string if not found/error.
 */
function safeGetAttr(docId, parentElementId, selector, attributeName) {
    try {
        const element = Widget.dom.selectFirst(docId, selector, parentElementId);
        return element ? Widget.dom.attr(element.id, attributeName) : "";
    } catch (e) {
        // console.error(`Error getting attribute "${attributeName}" for selector "${selector}":`, e);
        return "";
    }
}

// --- IMDb Module Implementation ---

/**
 * Fetches and processes trending data from IMDb.
 * @param {object} params - Parameters from the widget module config.
 * @param {string} params.contentType - 'movies', 'tv', or 'mixed'.
 * @param {string} params.maxResults - Maximum results as a string.
 * @returns {Promise<Array<object>>} A promise resolving to an array of result items.
 */
async function getImdbTrending(params = {}) {
    const { contentType = 'movies', maxResults = '25' } = params;
    const limit = parseInt(maxResults, 10) || 0; // 0 means no limit initially

    const movieUrl = "https://www.imdb.com/chart/moviemeter/";
    const tvUrl = "https://www.imdb.com/chart/tvmeter/";
    let urlsToFetch = [];

    if (contentType === 'movies') {
        urlsToFetch.push(movieUrl);
    } else if (contentType === 'tv') {
        urlsToFetch.push(tvUrl);
    } else { // mixed
        urlsToFetch.push(movieUrl);
        urlsToFetch.push(tvUrl);
    }

    console.log(`Fetching IMDb trends for: ${contentType}`);

    try {
        const headers = {
            // Crucial for IMDb to avoid blocking/different layouts
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
             "Accept-Language": "en-US,en;q=0.9" // Request English page
        };

        // Fetch all required pages concurrently
        const responses = await Promise.all(
            urlsToFetch.map(url => Widget.http.get(url, { headers }))
        );

        let allItems = [];
        for (const response of responses) {
            if (!response || !response.data) {
                console.warn(`Failed to fetch or empty data from ${response.url}`);
                continue;
            }

            const docId = Widget.dom.parse(response.data);
            if (!docId) {
                console.warn(`Failed to parse HTML from ${response.url}`);
                continue;
            }

             // IMDb selector - NOTE: This is fragile and might change!
            const listSelector = "ul[data-testid='chart-layout-main-list'] > li"; // More specific selector based on inspection
            const listItems = Widget.dom.select(docId, listSelector);

            console.log(`Found ${listItems.length} potential items on ${response.url}`);


            for (const item of listItems) {
                const parentElementId = item.id;

                 // Extract data using safe helper functions
                const title = safeGetText(docId, parentElementId, "h3.ipc-title__text");
                let coverUrl = safeGetAttr(docId, parentElementId, "img.ipc-image", "src");
                const linkHref = safeGetAttr(docId, parentElementId, "a.ipc-title-link-wrapper", "href");

                // IMDb ID extraction (e.g., /title/tt1234567/)
                const idMatch = linkHref ? linkHref.match(/\/title\/(tt\d+)\//) : null;
                const imdbId = idMatch ? idMatch[1] : null;

                // Basic validation
                if (title && coverUrl && imdbId) {
                     // Sometimes IMDb uses low-res placeholders, try to get full res if pattern matches
                     if (coverUrl.includes("._V1_")) {
                         coverUrl = coverUrl.replace(/(\._V1_).*(UX|UY|CR|AL)\d*_?.*(\.jpg)$/, "$1$3");
                     }

                    allItems.push({
                        id: imdbId, // Use IMDb ID
                        type: "imdb", // Custom type for IMDb items
                        title: title.replace(/^\d+\.\s*/, ''), // Remove ranking number like "1. "
                        coverUrl: coverUrl,
                        // description: "", // Description not easily available on chart page
                        // durationText: "", // Not applicable/available
                        // previewUrl: "" // Not applicable/available
                    });
                } else {
                    // console.warn("Skipping item due to missing data:", { title, coverUrl, imdbId, linkHref });
                }
            }
             // Release the parsed document to free memory
            Widget.dom.dispose(docId);
        }

        // Limit results if needed
        const limitedItems = (limit > 0 && allItems.length > limit) ? allItems.slice(0, limit) : allItems;
        console.log(`Returning ${limitedItems.length} IMDb items.`);
        return limitedItems;

    } catch (error) {
        console.error("Error fetching or processing IMDb data:", error);
        // Re-throw the error to be handled by the ForwardWidget environment
        throw new Error(`Failed to fetch IMDb data: ${error.message}`);
    }
}


// --- Bangumi Module Implementation ---

/**
 * Fetches and processes trending anime data from Bangumi.
 * @param {object} params - Parameters from the widget module config.
 * @param {string} params.maxResults - Maximum results as a string.
 * @returns {Promise<Array<object>>} A promise resolving to an array of result items.
 */
async function getBangumiTrends(params = {}) {
    const { maxResults = '25' } = params;
    const limit = parseInt(maxResults, 10) || 0; // 0 means no limit initially
    const url = "https://bgm.tv/anime/browser/?sort=trends";

    console.log("Fetching Bangumi Anime trends...");

    try {
        const headers = {
            // Bangumi is less strict, but User-Agent is good practice
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        };

        const response = await Widget.http.get(url, { headers });

        if (!response || !response.data) {
            throw new Error("Failed to fetch data from Bangumi or response was empty.");
        }

        const docId = Widget.dom.parse(response.data);
        if (!docId) {
            throw new Error("Failed to parse Bangumi HTML.");
        }

        // Selector for the list items
        const listSelector = "#browserItemList > li";
        const listItems = Widget.dom.select(docId, listSelector);

        console.log(`Found ${listItems.length} potential items on Bangumi.`);

        let results = [];
        for (const item of listItems) {
             // Optional limit application during iteration
             if (limit > 0 && results.length >= limit) {
                break;
            }

            const parentElementId = item.id;

            // Extract data using safe helper functions
            const title = safeGetText(docId, parentElementId, "h3 > a.l");
            // Item URL serves as ID
            let itemUrl = safeGetAttr(docId, parentElementId, "h3 > a.l", "href");
             // Cover URL - Bangumi uses img with class 'cover' inside a link
            let coverUrl = safeGetAttr(docId, parentElementId, "a.cover > img.cover", "src");
             // Fallback if image is lazy loaded using data-cfsrc
             if (!coverUrl) {
                 coverUrl = safeGetAttr(docId, parentElementId, "a.cover > img.cover", "data-cfsrc");
             }
            const description = safeGetText(docId, parentElementId, "p.info.tip");

            // Ensure URLs are absolute (Bangumi seems to use //domain... or full https://)
             if (itemUrl && itemUrl.startsWith("//")) {
                 itemUrl = "https:" + itemUrl;
             } else if (itemUrl && itemUrl.startsWith("/")) {
                 itemUrl = "https://bgm.tv" + itemUrl;
             }

            if (coverUrl && coverUrl.startsWith("//")) {
                coverUrl = "https:" + coverUrl;
            }

            // Basic validation
            if (title && itemUrl && coverUrl) {
                results.push({
                    id: itemUrl, // Use the item's Bangumi URL as the ID
                    type: "url", // Standard type for URL-based items
                    title: title,
                    coverUrl: coverUrl,
                    description: description || "", // Include description if found
                    // durationText: "", // Not applicable
                    // previewUrl: "" // Not applicable
                });
            } else {
                 // console.warn("Skipping Bangumi item due to missing data:", { title, itemUrl, coverUrl });
            }
        }

         // Release the parsed document
        Widget.dom.dispose(docId);

        // Apply limit again just in case (though loop should handle it)
        const limitedResults = (limit > 0 && results.length > limit) ? results.slice(0, limit) : results;
        console.log(`Returning ${limitedResults.length} Bangumi items.`);
        return limitedResults;

    } catch (error) {
        console.error("Error fetching or processing Bangumi data:", error);
        // Re-throw the error
        throw new Error(`Failed to fetch Bangumi data: ${error.message}`);
    }
}
