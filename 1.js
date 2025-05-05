// ==ForwardWidget==
var WidgetMetadata = {
    id: "trends-imdb-bangumi-v1.1", // Unique identifier (updated version)
    title: "IMDb & Bangumi Trends", // Display title
    description: "Fetches trending Movies/TV Shows from IMDb charts (MovieMeter/TVMeter) and trending Anime from Bangumi. Uses robust parsing for IMDb.", // Widget description
    author: "CCE v2.7 (Inspired by pack1r)", // Author name
    site: "https://github.com/CognitiveCatalystEngine", // Author/support website
    version: "1.1.0", // Widget version (updated)
    requiredVersion: "0.0.1", // Minimum ForwardWidget version required
    modules: [
        {
            title: "IMDb Trending Charts", // Module title
            description: "Fetches MovieMeter or TVMeter trending lists from IMDb.", // Module description
            requiresWebView: false, // Does not require WebView
            functionName: "getImdbTrendingCharts", // Processing function name (more specific)
            sectionMode: false, // Does not support section mode
            params: [
                {
                    name: "chartType",
                    title: "IMDb Chart",
                    type: "enumeration", // Use enumeration for predefined charts
                    description: "Select the IMDb chart to fetch",
                    value: "movies", // Default value
                    enumOptions: [ // Options for enumeration
                        { title: "MovieMeter (Trending Movies)", value: "movies" },
                        { title: "TVMeter (Trending TV Shows)", value: "tv" },
                        { title: "Mixed (MovieMeter + TVMeter)", value: "mixed" }
                    ]
                },
                {
                    name: "maxResults",
                    title: "Max Results",
                    type: "count", // Count type
                    description: "Maximum number of results per chart (0 for all)",
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
        return element ? Widget.dom.text(element.id).trim() : "";
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

/**
 * Extracts IMDb ID (tt...) from a URL string.
 * @param {string} urlString - The URL string.
 * @returns {string|null} The IMDb ID (e.g., "tt1234567") or null.
 */
function extractImdbId(urlString) {
    if (!urlString) return null;
    const match = urlString.match(/\/title\/(tt\d+)/);
    return match ? match[1] : null;
}

/**
 * Attempts to parse embedded LD+JSON data for IMDb lists.
 * @param {string} htmlString - The raw HTML content.
 * @returns {Array<object>|null} An array of parsed items or null if failed.
 */
function parseImdbLdJson(htmlString) {
    try {
        const ldJsonMatch = htmlString.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (ldJsonMatch && ldJsonMatch[1]) {
            const json = JSON.parse(ldJsonMatch[1]);
            // Check if it looks like an ItemList
            if (json && json['@type'] === 'ItemList' && Array.isArray(json.itemListElement)) {
                const items = [];
                for (const item of json.itemListElement) {
                    const imdbId = extractImdbId(item.item?.url || item.url); // Handle both potential structures
                    const title = item.item?.name || item.name;
                    const coverUrl = item.item?.image || item.image;

                    if (imdbId && title) {
                         let finalCoverUrl = coverUrl || "";
                         // Attempt to get higher-res image URL
                         if (finalCoverUrl.includes("._V1_")) {
                             finalCoverUrl = finalCoverUrl.replace(/(\._V1_).*(UX|UY|CR|AL)\d*_?.*(\.jpg)$/, "$1$3");
                         }

                        items.push({
                            id: imdbId,
                            type: "imdb",
                            title: title.trim(),
                            coverUrl: finalCoverUrl,
                            // description: item.description || "", // Often missing or generic in ld+json
                        });
                    }
                }
                if (items.length > 0) {
                    console.log(`Successfully parsed ${items.length} items from embedded LD+JSON.`);
                    return items;
                }
            }
        }
    } catch (e) {
        console.warn("Failed to parse LD+JSON data:", e.message);
    }
    console.log("LD+JSON parsing did not yield results or failed. Falling back to DOM parsing.");
    return null; // Indicate failure or no relevant data found
}

// --- IMDb Module Implementation ---

/**
 * Fetches and processes trending data from IMDb charts (MovieMeter/TVMeter).
 * Tries LD+JSON parsing first, then falls back to DOM scraping.
 * @param {object} params - Parameters from the widget module config.
 * @param {string} params.chartType - 'movies', 'tv', or 'mixed'.
 * @param {string} params.maxResults - Maximum results as a string.
 * @returns {Promise<Array<object>>} A promise resolving to an array of result items.
 */
async function getImdbTrendingCharts(params = {}) {
    const { chartType = 'movies', maxResults = '25' } = params;
    const limit = parseInt(maxResults, 10) || 0; // 0 means no limit initially

    const movieUrl = "https://www.imdb.com/chart/moviemeter/";
    const tvUrl = "https://www.imdb.com/chart/tvmeter/";
    let urlsToFetch = [];

    if (chartType === 'movies') {
        urlsToFetch.push(movieUrl);
    } else if (chartType === 'tv') {
        urlsToFetch.push(tvUrl);
    } else { // mixed
        urlsToFetch.push(movieUrl);
        urlsToFetch.push(tvUrl);
    }

    console.log(`Fetching IMDb charts for: ${chartType}`);

    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9" // Request English page to aid selector stability
        };

        const responses = await Promise.all(
            urlsToFetch.map(url => Widget.http.get(url, { headers }))
        );

        let allItems = [];
        for (const response of responses) {
            if (!response || !response.data) {
                console.warn(`Failed to fetch or empty data from ${response.url || 'unknown URL'}`);
                continue;
            }

            const htmlString = response.data;
            let parsedItems = parseImdbLdJson(htmlString); // Attempt LD+JSON first

            if (!parsedItems) { // Fallback to DOM parsing
                parsedItems = []; // Reset to empty array for DOM results
                let docId = -1;
                try {
                    docId = Widget.dom.parse(htmlString);
                    if (docId < 0) {
                         console.warn(`Failed to parse HTML DOM from ${response.url || 'unknown URL'}`);
                         continue; // Skip this response if DOM parsing fails
                    }

                    // IMDb selector for list items (adjust if needed)
                    const listSelector = "ul[data-testid='chart-layout-main-list'] > li";
                    const listItems = Widget.dom.select(docId, listSelector);
                    console.log(`DOM Parsing: Found ${listItems.length} potential items on ${response.url || 'unknown URL'}`);

                    for (const item of listItems) {
                        const parentElementId = item.id;
                        const titleElementSelector = "h3.ipc-title__text";
                        const imageSelector = "img.ipc-image";
                        const linkSelector = "a.ipc-title-link-wrapper";

                        const title = safeGetText(docId, parentElementId, titleElementSelector);
                        let coverUrl = safeGetAttr(docId, parentElementId, imageSelector, "src");
                        const linkHref = safeGetAttr(docId, parentElementId, linkSelector, "href");
                        const imdbId = extractImdbId(linkHref);

                        if (title && imdbId) { // Cover URL can sometimes be missing initially
                            // Attempt to get higher-res image URL
                            if (coverUrl && coverUrl.includes("._V1_")) {
                                coverUrl = coverUrl.replace(/(\._V1_).*(UX|UY|CR|AL)\d*_?.*(\.jpg)$/, "$1$3");
                            }

                            parsedItems.push({
                                id: imdbId,
                                type: "imdb",
                                title: title.replace(/^\d+\.\s*/, '').trim(), // Remove ranking like "1. "
                                coverUrl: coverUrl || "", // Use empty string if missing
                            });
                        } else {
                             // console.warn("DOM Parsing: Skipping item due to missing title or ID:", { title, imdbId, linkHref });
                        }
                    }
                } catch (domError) {
                     console.error(`Error during DOM parsing for ${response.url || 'unknown URL'}:`, domError);
                } finally {
                     if (docId >= 0) {
                        Widget.dom.dispose(docId); // Dispose DOM object
                     }
                }
            } // End of DOM parsing fallback

            allItems = allItems.concat(parsedItems || []); // Add successfully parsed items
        } // End loop through responses

        // Apply limit if needed
        const limitedItems = (limit > 0 && allItems.length > limit) ? allItems.slice(0, limit) : allItems;
        console.log(`Returning ${limitedItems.length} IMDb items.`);
        return limitedItems;

    } catch (error) {
        console.error("Error fetching or processing IMDb chart data:", error);
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
    let docId = -1; // Initialize docId outside try

    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        };

        const response = await Widget.http.get(url, { headers });

        if (!response || !response.data) {
            throw new Error("Failed to fetch data from Bangumi or response was empty.");
        }

        docId = Widget.dom.parse(response.data);
        if (docId < 0) {
            throw new Error("Failed to parse Bangumi HTML.");
        }

        // Selector for the list items
        const listSelector = "#browserItemList > li";
        const listItems = Widget.dom.select(docId, listSelector);

        console.log(`Found ${listItems.length} potential items on Bangumi.`);

        let results = [];
        for (const item of listItems) {
             if (limit > 0 && results.length >= limit) {
                break; // Stop processing if limit is reached
            }

            const parentElementId = item.id;
            const titleSelector = "h3 > a.l";
            const imageSelector = "a.cover > img.cover"; // Primary selector
            const descriptionSelector = "p.info.tip";

            const title = safeGetText(docId, parentElementId, titleSelector);
            let itemUrl = safeGetAttr(docId, parentElementId, titleSelector, "href");
            let coverUrl = safeGetAttr(docId, parentElementId, imageSelector, "src");
            // Fallback for lazy-loaded images often stored in data attributes
             if (!coverUrl) {
                 coverUrl = safeGetAttr(docId, parentElementId, imageSelector, "data-src") ||
                            safeGetAttr(docId, parentElementId, imageSelector, "data-cfsrc");
             }
            const description = safeGetText(docId, parentElementId, descriptionSelector);

            // Ensure URLs are absolute
             if (itemUrl && itemUrl.startsWith("//")) {
                 itemUrl = "https:" + itemUrl;
             } else if (itemUrl && itemUrl.startsWith("/")) {
                 itemUrl = "https://bgm.tv" + itemUrl;
             }

            if (coverUrl && coverUrl.startsWith("//")) {
                coverUrl = "https:" + coverUrl;
            }

            if (title && itemUrl) { // Title and URL are essential
                results.push({
                    id: itemUrl, // Use the item's Bangumi URL as the ID
                    type: "url", // Standard type for URL-based items
                    title: title,
                    coverUrl: coverUrl || "", // Use empty string if cover is missing
                    description: description || "", // Include description if found
                });
            } else {
                 // console.warn("Skipping Bangumi item due to missing title or URL:", { title, itemUrl });
            }
        } // End loop through list items

        // Apply limit again just in case (though loop should handle it)
        const limitedResults = (limit > 0 && results.length > limit) ? results.slice(0, limit) : results;
        console.log(`Returning ${limitedResults.length} Bangumi items.`);
        return limitedResults;

    } catch (error) {
        console.error("Error fetching or processing Bangumi data:", error);
        throw new Error(`Failed to fetch Bangumi data: ${error.message}`);
    } finally {
        // Ensure DOM object is always disposed if it was created
        if (docId >= 0) {
            Widget.dom.dispose(docId);
            console.log("Disposed Bangumi DOM object.");
        }
    }
}
