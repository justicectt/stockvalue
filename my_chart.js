// ==========================================================================
// 台股成交金額泡泡圖
// 平衡版：靠上排版 + 文字清楚 + 不要滿出版
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runVisualization);
} else {
    runVisualization();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function initChart(nodes) {
    const chartEl = document.getElementById("chart");

    if (!chartEl) {
        console.error("[錯誤] 找不到 #chart 容器。");
        return;
    }

    // 修正容器，避免被原本 flex 置中造成上下黑邊
    chartEl.style.display = "block";
    chartEl.style.width = "100vw";
    chartEl.style.height = "calc(100vh - 38px)";
    chartEl.style.marginTop = "38px";
    chartEl.style.paddingTop = "0";
    chartEl.style.overflow = "hidden";

    const width = chartEl.clientWidth;
    const height = chartEl.clientHeight;
    const isMobile = width < 768;

    if (width <= 0 || height <= 0) {
        console.error("[錯誤] 圖表容器尺寸異常。");
        return;
    }

    const chartContainer = d3.select("#chart");
    chartContainer.selectAll("*").remove();

    const svg = chartContainer
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMin meet")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "#121212");

    const maxVol = d3.max(
        nodes,
        d => Math.max(d.volToday || 0, d.volPrevious || 0)
    ) || 100;

    // ------------------------------
    // 泡泡大小：比上一版縮小，避免手機塞爆
    // ------------------------------
    const maxRadius = isMobile
        ? clamp(width * 0.062, 28, 48)
        : clamp(width * 0.05, 34, 58);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVol])
        .range([0, maxRadius]);

    // 泡泡群中心位置：往上，但不要太高
    const targetY = isMobile ? height * 0.34 : height * 0.36;

    const simulation = d3.forceSimulation(nodes)
        .force("x", d3.forceX(width / 2).strength(0.07))
        .force("y", d3.forceY(targetY).strength(0.09))
        .force(
            "collide",
            d3.forceCollide()
                .radius(d =>
                    Math.max(
                        radiusScale(d.volToday || 0),
                        radiusScale(d.volPrevious || 0)
                    ) + 3
                )
                .iterations(3)
        )
        .on("tick", ticked);

    const nodeGroups = svg
        .selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node");

    // ======================================================================
    // 今日實心圈
    // ======================================================================
    nodeGroups.append("circle")
        .attr("class", "today-circle")
        .attr("r", d => radiusScale(d.volToday || 0))
        .attr("stroke-width", d => d.isNew ? 3 : 1.3)
        .attr("stroke", d => d.isNew ? "#FFD54F" : "#161616")
        .attr("fill", d => {
            const pct = d.price_change_pct || 0;
            if (pct >= 9.5) return "#D93030";   // 漲停
            if (pct > 0) return "#FF4D57";      // 上漲
            if (pct <= -9.5) return "#087F3D";  // 跌停
            if (pct < 0) return "#0FA958";      // 下跌
            return "#686868";                   // 平盤
        });

    // ======================================================================
    // 昨日虛線圈（後畫，才不會被今日圈蓋住）
    // ======================================================================
    nodeGroups.append("circle")
        .attr("class", "previous-circle")
        .attr("r", d => radiusScale(d.volPrevious || 0))
        .attr("fill", "none")
        .attr("stroke", "#CFCFCF")
        .attr("stroke-width", 1.6)
        .attr("stroke-dasharray", "4,3")
        .attr("opacity", 0.9)
        .style("pointer-events", "none");

    // ======================================================================
    // 股票名稱
    // 字體比原版大，但比上一版收斂
    // ======================================================================
    nodeGroups.append("text")
        .attr("class", "stock-name")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("fill", "#FFFFFF")
        .style("font-size", d => {
            const r = radiusScale(d.volToday || 0);
            return clamp(r * 0.27, 9.5, 14.5) + "px";
        })
        .style("font-weight", "700")
        .style("paint-order", "stroke")
        .style("stroke", "rgba(0,0,0,0.85)")
        .style("stroke-width", "2.6px")
        .style("stroke-linejoin", "round")
        .style("pointer-events", "none")
        .text(d => d.name || d.code || d.id);

    // ======================================================================
    // 成交金額
    // 用淡黃色凸顯，但不放太大
    // ======================================================================
    nodeGroups.append("text")
        .attr("class", "stock-volume")
        .attr("text-anchor", "middle")
        .attr("dy", "1.15em")
        .style("fill", "#FFE082")
        .style("font-size", d => {
            const r = radiusScale(d.volToday || 0);
            return clamp(r * 0.21, 8.5, 12.5) + "px";
        })
        .style("font-weight", "700")
        .style("paint-order", "stroke")
        .style("stroke", "rgba(0,0,0,0.9)")
        .style("stroke-width", "2.2px")
        .style("stroke-linejoin", "round")
        .style("pointer-events", "none")
        .text(d => Math.round(d.volToday || 0) + "億");

    function ticked() {
        nodeGroups.attr("transform", d => {
            const r = Math.max(
                radiusScale(d.volToday || 0),
                radiusScale(d.volPrevious || 0)
            );

            const margin = 4;

            d.x = Math.max(r + margin, Math.min(width - r - margin, d.x));
            d.y = Math.max(r + margin, Math.min(height - r - margin, d.y));

            return `translate(${d.x},${d.y})`;
        });
    }
}

// 視窗尺寸變更時重新繪圖
let resizeTimer = null;

window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        if (typeof stock_data !== "undefined" && stock_data.nodes && stock_data.nodes.length) {
            initChart(stock_data.nodes);
        }
    }, 250);
});
