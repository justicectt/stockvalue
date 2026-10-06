// ==========================================================================
// 台股成交金額泡泡圖
// 原版核心 + 上移版面 + 強化文字 + 昨日虛線圈
// ==========================================================================

function updateHeaderTime() {
    if (typeof stock_data === "undefined") return;

    const dateElem = document.getElementById("data-date");
    const timeElem = document.getElementById("crawl-time");

    if (dateElem && (stock_data.dataTime || stock_data.updateTime)) {
        dateElem.textContent = stock_data.dataTime || stock_data.updateTime;
    }

    if (timeElem && stock_data.crawlTime) {
        timeElem.textContent = stock_data.crawlTime;
    }
}

function runVisualization() {
    updateHeaderTime();

    if (typeof stock_data === "undefined") {
        console.error("[錯誤] 找不到 stock_data，請確認 data.js 是否正確載入。");
        return;
    }

    const nodes = stock_data.nodes || stock_data;

    if (!nodes || !nodes.length) {
        console.warn("[警告] stock_data 節點資料為空。");
        return;
    }

    console.log("資料讀取成功，節點數量：", nodes.length);
    initChart(nodes);
}


// ==========================================================================
// DOM 載入完成後執行
// ==========================================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runVisualization);
} else {
    runVisualization();
}


// ==========================================================================
// 主圖表
// ==========================================================================
function initChart(nodes) {
    const chartEl = document.getElementById("chart");

    if (!chartEl) {
        console.error("[錯誤] 找不到 #chart 容器。");
        return;
    }

    // ----------------------------------------------------------------------
    // 修正原本 index.html 的置中設定
    // 讓圖表直接接在 38px Header 下方
    // ----------------------------------------------------------------------
    chartEl.style.display = "block";
    chartEl.style.width = "100vw";
    chartEl.style.height = "calc(100vh - 38px)";
    chartEl.style.marginTop = "38px";
    chartEl.style.paddingTop = "0";
    chartEl.style.overflow = "hidden";

    const width = chartEl.clientWidth;
    const height = chartEl.clientHeight;

    if (width <= 0 || height <= 0) {
        console.error("[錯誤] 圖表容器尺寸異常。");
        return;
    }

    const chartContainer = d3.select("#chart");
    chartContainer.selectAll("*").remove();

    // ----------------------------------------------------------------------
    // SVG 使用實際螢幕比例
    // 不再使用固定 1000 x 800，因此手機直向不會產生大量上下黑邊
    // ----------------------------------------------------------------------
    const svg = chartContainer
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMin meet")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "#121212");

    // ----------------------------------------------------------------------
    // 成交金額 → 泡泡半徑
    // scaleSqrt 保持面積與成交金額大致成比例
    // ----------------------------------------------------------------------
    const maxVol = d3.max(
        nodes,
        d => Math.max(d.volToday || 0, d.volPrevious || 0)
    ) || 100;

    // 手機上稍微放大泡泡，但仍維持 0 起點的比例關係
    const maxRadius = Math.min(
        78,
        Math.max(64, width * 0.095)
    );

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVol])
        .range([0, maxRadius]);

    // ----------------------------------------------------------------------
    // 力導向
    // Y 軸目標移到畫面約 30% 高度
    // ----------------------------------------------------------------------
    const targetY = height * 0.30;

    const simulation = d3.forceSimulation(nodes)
        .force(
            "x",
            d3.forceX(width / 2)
                .strength(0.075)
        )
        .force(
            "y",
            d3.forceY(targetY)
                .strength(0.095)
        )
        .force(
            "collide",
            d3.forceCollide()
                .radius(d =>
                    Math.max(
                        radiusScale(d.volToday || 0),
                        radiusScale(d.volPrevious || 0)
                    ) + 5
                )
                .iterations(3)
        )
        .on("tick", ticked);

    // ----------------------------------------------------------------------
    // 節點群組
    // ----------------------------------------------------------------------
    const nodeGroups = svg
        .selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node");

    // ======================================================================
    // 第一層：今日實心圈
    // ======================================================================
    nodeGroups.append("circle")
        .attr("class", "today-circle")
        .attr("r", d => radiusScale(d.volToday || 0))
        .attr("stroke-width", d => d.isNew ? 3.5 : 1.5)
        .attr("stroke", d => {
            if (d.isNew) return "#FFD54F";
            return "#161616";
        })
        .attr("fill", d => {
            const pct = d.price_change_pct || 0;

            if (pct >= 9.5) return "#D93030";   // 漲停
            if (pct > 0) return "#FF4D57";      // 上漲
            if (pct <= -9.5) return "#087F3D";  // 跌停
            if (pct < 0) return "#0FA958";      // 下跌

            return "#686868";                   // 平盤
        });


    // ======================================================================
    // 第二層：昨日虛線圈
    // 放在今日圈之後繪製，所以昨日較小時也不會被蓋住
    // ======================================================================
    nodeGroups.append("circle")
        .attr("class", "previous-circle")
        .attr("r", d => radiusScale(d.volPrevious || 0))
        .attr("fill", "none")
        .attr("stroke", "#D0D0D0")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,4")
        .attr("opacity", 0.9)
        .style("pointer-events", "none");


    // ======================================================================
    // 第三層：股票名稱
    // 動態字體 + 黑色外框，提高紅綠背景上的辨識度
    // ======================================================================
    nodeGroups.append("text")
        .attr("class", "stock-name")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.25em")
        .style("fill", "#FFFFFF")
        .style("font-size", d => {
            const r = radiusScale(d.volToday || 0);
            return Math.max(12, Math.min(17, r * 0.32)) + "px";
        })
        .style("font-weight", "700")
        .style("paint-order", "stroke")
        .style("stroke", "rgba(0,0,0,0.8)")
        .style("stroke-width", "3px")
        .style("stroke-linejoin", "round")
        .style("pointer-events", "none")
        .text(d => d.name || d.code || d.id);


    // ======================================================================
    // 第四層：成交金額
    // 使用淡黃色，和股票名稱形成明顯區隔
    // ======================================================================
    nodeGroups.append("text")
        .attr("class", "stock-volume")
        .attr("text-anchor", "middle")
        .attr("dy", "1.25em")
        .style("fill", "#FFE082")
        .style("font-size", d => {
            const r = radiusScale(d.volToday || 0);
            return Math.max(11, Math.min(15, r * 0.27)) + "px";
        })
        .style("font-weight", "700")
        .style("paint-order", "stroke")
        .style("stroke", "rgba(0,0,0,0.85)")
        .style("stroke-width", "2.5px")
        .style("stroke-linejoin", "round")
        .style("pointer-events", "none")
        .text(d => {
            const vol = d.volToday || 0;

            if (vol >= 1000) {
                return Math.round(vol).toLocaleString() + "億";
            }

            return Math.round(vol) + "億";
        });


    // ======================================================================
    // 每次模擬更新
    // 同時限制泡泡不能超出畫布
    // ======================================================================
    function ticked() {
        nodeGroups.attr("transform", d => {
            const r = Math.max(
                radiusScale(d.volToday || 0),
                radiusScale(d.volPrevious || 0)
            );

            const margin = 5;

            d.x = Math.max(
                r + margin,
                Math.min(width - r - margin, d.x)
            );

            d.y = Math.max(
                r + margin,
                Math.min(height - r - margin, d.y)
            );

            return `translate(${d.x},${d.y})`;
        });
    }
}


// ==========================================================================
// 手機旋轉或視窗尺寸改變時重新繪圖
// ==========================================================================
let resizeTimer = null;

window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(function () {
        if (
            typeof stock_data !== "undefined" &&
            stock_data.nodes &&
            stock_data.nodes.length
        ) {
            initChart(stock_data.nodes);
        }
    }, 250);
});
