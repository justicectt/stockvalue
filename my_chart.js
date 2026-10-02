// ==========================================================================
// 股市成交值視覺化 - 泡泡圖 (原版核心 + 雙行成交額文字版)
// ==========================================================================

function updateHeaderTime() {
    if (typeof stock_data !== "undefined") {
        const dateElem = document.getElementById("data-date");
        const timeElem = document.getElementById("crawl-time");

        if (dateElem && (stock_data.dataTime || stock_data.updateTime)) {
            dateElem.textContent = stock_data.dataTime || stock_data.updateTime;
        }

        if (timeElem && stock_data.crawlTime) {
            timeElem.textContent = stock_data.crawlTime;
        }
    }
}

function runVisualization() {
    // 1. 更新頂部狀態列時間
    updateHeaderTime();

    // 2. 檢查資料變數是否存在
    if (typeof stock_data === "undefined") {
        console.error("[錯誤] 找不到 stock_data 變數，請確認 data.js 是否存在且正確引入。");
        return;
    }

    // 相容不同的資料結構格式
    const nodes = stock_data.nodes || stock_data;

    if (!nodes || nodes.length === 0) {
        console.warn("[警告] stock_data 節點資料為空！");
        return;
    }

    console.log("資料讀取成功，開始渲染畫布！節點數量：", nodes.length);
    initChart(nodes);
}

// 確保 DOM 元素徹底載入完成後才執行繪圖
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runVisualization);
} else {
    runVisualization();
}

function initChart(nodes) {
    const width = 1000;
    const height = 800;

    // 清空原容器，避免重複渲染
    const chartContainer = d3.select("#chart");
    chartContainer.selectAll("*").remove();

    // 3. 設定畫布：加入 viewBox 與 preserveAspectRatio，手機與電腦皆能自適應縮放
    const svg = chartContainer
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("max-height", "100vh")
        .style("background-color", "#121212");

    // 4. 設定半徑比例尺：開根號確保泡泡面積與成交金額大致成正比
    const maxVol = d3.max(
        nodes,
        d => Math.max(d.volToday || 0, d.volPrevious || 0)
    ) || 100;

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVol])
        .range([0, 60]);

    // 5. 定義 D3 泡泡力導向圖
    const simulation = d3.forceSimulation(nodes)
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY(height / 2).strength(0.05))
        .force(
            "collide",
            d3.forceCollide(
                d => Math.max(
                    radiusScale(d.volToday || 0),
                    radiusScale(d.volPrevious || 0)
                ) + 4
            )
        )
        .on("tick", ticked);

    // 6. 建立泡泡群組
    const nodeGroups = svg.selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node");

    // ======================================================================
    // 核心視覺渲染規範：雙圈設計
    // ======================================================================

    // [層級一：昨日圈]
    nodeGroups.append("circle")
        .attr("class", "previous-circle")
        .attr("r", d => radiusScale(d.volPrevious || 0))
        .attr("fill", "none")
        .attr("stroke", "#555555")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // [層級二：今日圈]
    nodeGroups.append("circle")
        .attr("class", "today-circle")
        .attr("r", d => radiusScale(d.volToday || 0))
        .attr("stroke-width", d => d.isNew ? 3 : 1.5)
        .attr("stroke", d => {
            if (d.isNew) return "#FFD700";
            return "#000000";
        })
        .attr("fill", d => {
            const pct = d.price_change_pct || 0;

            if (pct >= 9.5) return "#D32F2F";   // 漲停
            if (pct > 0) return "#FF5252";      // 上漲
            if (pct <= -9.5) return "#388E3C";  // 跌停
            if (pct < 0) return "#4CAF50";      // 下跌

            return "#757575";                    // 平盤
        });

    // 7. 第一行：股名
    nodeGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("fill", "#FFFFFF")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .text(d => d.name || d.code);

    // 8. 第二行：成交金額
    nodeGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.2em")
        .style("fill", "#FFFFFF")
        .style("font-size", "9px")
        .style("pointer-events", "none")
        .text(d => Math.round(d.volToday || 0) + "億");

    // 9. 力導向位置更新
    function ticked() {
        nodeGroups.attr(
            "transform",
            d => `translate(${d.x},${d.y})`
        );
    }
}