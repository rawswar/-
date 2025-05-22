// Widget 元数据配置
var WidgetMetadata = {
    id: "bangumi_charts",
    title: "Bangumi 热门榜单",
    description: "从 Bangumi (bgm.tv) 获取动画、书籍等热门榜单。",
    author: "rawswar", 
    site: "https://github.com/rawswar/-", 
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "近期热门 (趋势)",
            description: "按作品类型浏览近期热门内容 (固定按热度 trends 排序)",
            requiresWebView: false,
            functionName: "fetchRecentHot",
            params: [
                {
                    name: "category",
                    title: "分类",
                    type: "enumeration",
                    value: "anime", // 默认动画
                    enumOptions: [
                        { title: "动画", value: "anime" },
                        { title: "书籍", value: "book" },
                        { title: "音乐", value: "music" },
                        { title: "游戏", value: "game" },
                        { title: "三次元", value: "real" }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                    value: "1"
                }
            ]
        },
        {
            title: "放送/发售时段排行",
            description: "按年份、季度/全年及作品类型浏览排行",
            requiresWebView: false,
            functionName: "fetchAirtimeRanking",
            params: [
                {
                    name: "category",
                    title: "分类",
                    type: "enumeration",
                    value: "anime", // 默认动画
                    enumOptions: [ // 确认支持 airtime 的分类
                        { title: "动画", value: "anime" },
                        { title: "书籍", value: "book" }, // 书籍通常按出版日期，可能适用
                        { title: "音乐", value: "music" }, // 音乐通常按发售日期
                        { title: "游戏", value: "game" },   // 游戏通常按发售日期
                        { title: "三次元", value: "real" } // 剧集等
                    ]
                },
                {
                    name: "year",
                    title: "年份",
                    type: "input",
                    description: "例如: 2024。留空则浏览所有年份。",
                    // value: new Date().getFullYear().toString() // 默认当年，但留空行为是浏览所有，所以不设默认值
                },
                {
                    name: "month", // 改为 month，更符合bgm的URL结构，all由函数处理
                    title: "月份/季度",
                    type: "enumeration",
                    value: "all", // 默认全年
                    description: "选择全年或特定季度对应的月份。留空则为全年。",
                    enumOptions: [
                        { title: "全年", value: "all" }, // 特殊值，由函数处理
                        { title: "冬季 (1月)", value: "1" },
                        { title: "春季 (4月)", value: "4" },
                        { title: "夏季 (7月)", value: "7" },
                        { title: "秋季 (10月)", value: "10" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序方式",
                    type: "enumeration",
                    value: "rank", // 年份排行默认按排名
                    enumOptions: [
                        { title: "排名", value: "rank" },
                        { title: "热度", value: "trends" },
                        { title: "收藏数", value: "collects" },
                        { title: "发售日期", value: "date" },
                        { title: "名称", value: "title" }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                    value: "1"
                }
            ]
        }
    ]
};

// --- 辅助函数 ---

/**
 * 解析 Bangumi 列表页的 HTML，提取条目信息
 * @param {string} htmlContent HTML 页面内容
 * @returns {Array<Object>} VideoItem 兼容的对象数组
 */
function parseBangumiItems(htmlContent) {
    const $ = Widget.html.load(htmlContent);
    const items = [];

    $('ul#browserItemList li.item').each((index, element) => {
        const $item = $(element);
        let subjectId = $item.attr('id');
        if (subjectId && subjectId.startsWith('item_')) {
            subjectId = subjectId.substring(5);
        } else {
            console.warn("无法获取 subjectId for item:", $item.html());
            return; // 跳过无效条目
        }

        const titleElement = $item.find('div.inner > h3 > a.l');
        const title = titleElement.text().trim();
        const detailLink = titleElement.attr('href');
        const fullDetailLink = detailLink ? `https://bgm.tv${detailLink}` : '';

        const japaneseTitle = $item.find('div.inner > h3 > small.grey').text().trim();

        let coverUrl = $item.find('a.subjectCover img.cover').attr('src');
        if (coverUrl && coverUrl.startsWith('//')) {
            coverUrl = 'https:' + coverUrl;
        }
        // Bangumi 图片尺寸通常是 /c/ (medium), /g/ (grid), /l/ (large), /m/ (mono), /s/ (small)
        // 尝试获取更大尺寸的封面，如果可用
        if (coverUrl && coverUrl.includes('/c/')) {
             // 优先尝试 large, 其次是 medium
            // backdropPath 可以尝试用 large cover (如果存在的话)
        }


        const rating = $item.find('div.inner > p.rateInfo > small.fade').text().trim();
        const ratingCountText = $item.find('div.inner > p.rateInfo > span.tip_j').text().trim();
        const ratingCountMatch = ratingCountText.match(/\((\d+)人评分\)/);
        const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1], 10) : 0;

        const infoText = $item.find('div.inner > p.info.tip').text().trim();
        
        let releaseDate = '';
        let mediaType = 'tv'; // 默认 TV 动画
        let description = japaneseTitle ? `${japaneseTitle}\n${infoText}` : infoText;

        // 尝试从 infoText 解析发布日期和媒体类型
        // 例如: "12话 / 2025年4月12日 / ..."  或 "剧场版 / 2025年冬 / ..."
        const infoParts = infoText.split('/').map(s => s.trim());
        
        // 尝试解析日期
        // 格式1: YYYY年M月D日
        const dateMatchYMD = infoText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (dateMatchYMD) {
            releaseDate = `${dateMatchYMD[1]}-${String(dateMatchYMD[2]).padStart(2, '0')}-${String(dateMatchYMD[3]).padStart(2, '0')}`;
        } else {
            // 格式2: YYYY年M月 (假设为该月1号)
            const dateMatchYM = infoText.match(/(\d{4})年(\d{1,2})月/);
            if (dateMatchYM) {
                releaseDate = `${dateMatchYM[1]}-${String(dateMatchYM[2]).padStart(2, '0')}-01`;
            } else {
                 // 格式3: YYYY年 (假设为该年1月1号)
                const dateMatchY = infoText.match(/(\d{4})年(?![\d月])/); // 确保后面不是数字或"月"
                if (dateMatchY) {
                     releaseDate = `${dateMatchY[1]}-01-01`;
                } else {
                    // 格式4: YYYY年冬/春/夏/秋
                    const seasonMatch = infoText.match(/(\d{4})年(冬|春|夏|秋)/);
                    if (seasonMatch) {
                        let month = '01'; // 冬
                        if (seasonMatch[2] === '春') month = '04';
                        else if (seasonMatch[2] === '夏') month = '07';
                        else if (seasonMatch[2] === '秋') month = '10';
                        releaseDate = `${seasonMatch[1]}-${month}-01`;
                    }
                }
            }
        }

        // 简单判断 mediaType (可以根据 category 参数进一步优化)
        if (infoParts.some(part => part.includes('剧场版') || part.includes('Movie'))) {
            mediaType = 'movie';
        } else if (infoParts.some(part => part.includes('OVA'))) {
            mediaType = 'tv'; // ForwardWidget 没有 'ova' 类型，暂归为 'tv'
        }
        // 对于书籍、音乐、游戏，mediaType 可能需要调整或不适用 VideoItem

        items.push({
            id: subjectId,
            type: "bangumi", // 自定义类型，或尝试映射到 douban/tmdb (如果需要应用内进一步处理)
            title: title,
            posterPath: coverUrl,
            backdropPath: '', // Bangumi 列表页似乎没有横向封面
            releaseDate: releaseDate,
            mediaType: mediaType,
            rating: rating || "0",
            // genreTitle: "", // 需要从详情页或标签页获取
            // duration: 0,
            // durationText: "",
            // previewUrl: "",
            // videoUrl: "", // Bangumi 不提供直接播放
            link: fullDetailLink,
            description: description,
            // childItems: []
        });
    });

    return items;
}

// --- 处理函数 ---

/**
 * 获取近期热门内容
 * @param {Object} params 参数对象
 * @param {string} params.category 分类 (anime, book, music, game, real)
 * @param {string|number} params.page 页码
 */
async function fetchRecentHot(params = {}) {
    const category = params.category || "anime";
    const page = params.page || 1;
    const url = `https://bgm.tv/${category}/browser/?sort=trends&page=${page}`;

    console.log(`Fetching Recent Hot: ${url}`);

    try {
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": `https://bgm.tv/${category}/browser/`
            }
        });

        if (response.data) {
            return parseBangumiItems(response.data);
        } else {
            throw new Error("未能获取到数据");
        }
    } catch (error) {
        console.error(`Error fetching recent hot for ${category} page ${page}:`, error);
        throw error; // 抛出错误，让应用处理
    }
}

/**
 * 获取放送/发售时段排行
 * @param {Object} params 参数对象
 * @param {string} params.category 分类
 * @param {string} params.year 年份 (e.g., "2024", "" for all years)
 * @param {string} params.month 月份/季度 ("all", "1", "4", "7", "10", "" for all for that year)
 * @param {string} params.sort 排序方式 (rank, trends, collects, date, title)
 * @param {string|number} params.page 页码
 */
async function fetchAirtimeRanking(params = {}) {
    const category = params.category || "anime";
    const year = params.year || ""; // "" 表示所有年份 (如果 month 也是 all/empty)
    let month = params.month || "all";
    const sort = params.sort || "rank";
    const page = params.page || 1;

    let airtimePath = "airtime";
    if (year) {
        airtimePath += `/${year}`;
        if (month && month !== "all") {
            airtimePath += `/${month}`;
        }
    } else {
        // 如果没有年份，则 month 参数无效，视为浏览所有（非 airtime 路径）
        // 这种情况下，更像是普通的 browser?sort=rank&page=X
        // 但为了与模块名"放送时段"对应，我们强制至少有年份或默认使用当前年份
        // 如果 year 为空，用户可能期望的是全部分类按排名，但 bgm 的 airtime 结构必须有 year
        // 此处做一个兼容：如果year为空，则不走airtime路径，而是普通browser
        if (!year && month === "all") { // 如果年份和月份都是空/all，则退化为普通浏览
            const fallbackUrl = `https://bgm.tv/${category}/browser/?sort=${sort}&page=${page}`;
            console.log(`Fetching Airtime Ranking (fallback to browser): ${fallbackUrl}`);
             try {
                const response = await Widget.http.get(fallbackUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                        "Referer": `https://bgm.tv/${category}/browser/`
                    }
                });
                if (response.data) return parseBangumiItems(response.data);
                else throw new Error("未能获取到数据 (fallback)");
            } catch (error) {
                console.error(`Error fetching airtime ranking (fallback) for ${category} page ${page}:`, error);
                throw error;
            }
        } else if (!year) {
            // 如果 year 为空但 month 不为 all (这其实是无效组合)，我们可以默认一个年份，或者报错
            // 这里选择报错或返回空，因为 URL 结构不明确
            console.warn("年份未指定，但月份已指定，无法构成有效 Airtime URL。");
            return [];
        }
    }


    const url = `https://bgm.tv/${category}/browser/${airtimePath}?sort=${sort}&page=${page}`;
    console.log(`Fetching Airtime Ranking: ${url}`);

    try {
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": `https://bgm.tv/${category}/browser/`
            }
        });

        if (response.data) {
            return parseBangumiItems(response.data);
        } else {
            throw new Error("未能获取到数据");
        }
    } catch (error) {
        console.error(`Error fetching airtime ranking for ${category} year ${year} month ${month} page ${page}:`, error);
        throw error;
    }
}

// 如果要实现详情页加载功能 (当返回数据 type: "link" 时)
// async function loadDetail(link) {
//     // link 会是类似 https://bgm.tv/subject/xxxxxx
//     try {
//         console.log("Loading detail for:", link);
//         const response = await Widget.http.get(link, {
//             headers: {
//                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
//             }
//         });
//         const htmlContent = response.data;
//         const $ = Widget.html.load(htmlContent);
//
//         // --- 从详情页提取 videoUrl (如果可能) 或其他更详细信息 ---
//         // Bangumi 本身不提供视频播放源，所以 videoUrl 可能很难获取
//         // 可以尝试提取更多描述信息、标签、episodes 等
//
//         // 示例：提取更详细的描述
//         // const detailedDescription = $('#subject_summary').text().trim();
//         // const poster = $('#bangumiInfo .cover').attr('src'); // 更大的封面
//
//         return {
//             // videoUrl: "some_video_url_if_found", // 很难
//             // description: detailedDescription || oldDescription
//             // posterPath: poster ? 'https:' + poster : oldPosterPath
//             // ... 其他可以从详情页补充的 VideoItem 字段
//         };
//     } catch (error) {
//         console.error("Error loading detail for link:", link, error);
//         throw error;
//     }
// }
