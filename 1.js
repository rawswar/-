WidgetMetadata = {
    id: "bangumi_anime_browser_trends",
    title: "Bangumi 动画热度榜",

    
    modules: [
        {
            title: "动画热度榜 (分页)",
            description: "按热度顺序显示 Bangumi 动画列表，可选择页码。",
            requiresWebView: false,
            functionName: "fetchBangumiAnimeTrends",
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
    ], 

    version: "1.0.3",                 
    requiredVersion: "0.0.1",          
    description: "浏览 Bangumi 按热度排序的动画列表，支持翻页。", 
    author: "t1st",       
    site: "https://bgm.tv"              

}; 

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

        
        const docId = Widget.dom.parse(response.data);
        if (docId < 0) {
        
            throw new Error("Failed to parse HTML document.");
        }
        console.log(`HTML parsed successfully (docId: ${docId})`);
        const itemContainerSelector = 'ul#browserItemList > li.item';
        const itemElementIds = Widget.dom.select(docId, itemContainerSelector);
        console.log(`Found ${itemElementIds.length} item containers.`);

        const videoItems = [];
        for (const itemId of itemElementIds) {
            try {
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

                const itemIdAttr = await Widget.dom.attr(itemId, 'id'); 
                const subjectId = itemIdAttr ? itemIdAttr.replace('item_', '') : detailLink; 

                const ratingSmallId = Widget.dom.select(itemId, '.inner p.rateInfo small.fade')[0];
                const ratingScore = ratingSmallId >= 0 ? (await Widget.dom.text(ratingSmallId)).trim() : "N/A";

                const infoPId = Widget.dom.select(itemId, '.inner p.info.tip')[0];
                const infoText = infoPId >= 0 ? (await Widget.dom.text(infoPId)).trim().replace(/\s\s+/g, ' ') : "";

                let releaseDate = "";
                const dateMatch = infoText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
                if (dateMatch && dateMatch[1]) {
                    releaseDate = dateMatch[1];
                }

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
                
            }
        } 

        console.log(`Executing ${WidgetMetadata.id}: Successfully processed ${videoItems.length} items from page ${page}.`);

        
        return videoItems;

    } catch (error) {
        console.error(`Error in ${WidgetMetadata.id} (Page ${page}):`, error);
        throw new Error(`[${WidgetMetadata.id}] Failed: ${error.message}`);
    } finally {
        
    }
}
