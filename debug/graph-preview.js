const projectionMinutesAhead = 60;
const chartWidth = 620;
const chartHeight = 320;
const margin = { top: 20, right: 20, bottom: 28, left: 48 };

const parseApiTimestamp = (value) => new Date(value);

const toApiTimestampString = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return formatter.format(date).replace(",", "");
};

const sortByTimestamp = (items) => {
  return [...items].sort(
    (left, right) =>
      parseApiTimestamp(left.Timestamp) - parseApiTimestamp(right.Timestamp),
  );
};

const calculateProjection = (data) => {
  const latestTime = parseApiTimestamp(
    data[data.length - 1].Timestamp,
  ).getTime();
  const analysisStart = latestTime - 30 * 60 * 1000;
  const recent = data.filter(
    (item) => parseApiTimestamp(item.Timestamp).getTime() >= analysisStart,
  );

  if (recent.length < 2) {
    return [];
  }

  const baseTime = parseApiTimestamp(recent[0].Timestamp).getTime();
  const normalized = recent.map((item) => ({
    x: (parseApiTimestamp(item.Timestamp).getTime() - baseTime) / 60000,
    y: item.Value,
  }));

  const count = normalized.length;
  const sumX = normalized.reduce((sum, point) => sum + point.x, 0);
  const sumY = normalized.reduce((sum, point) => sum + point.y, 0);
  const sumXY = normalized.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = normalized.reduce((sum, point) => sum + point.x * point.x, 0);
  const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / count;

  const points = [];
  for (let step = 1; step <= projectionMinutesAhead / 5; step += 1) {
    const timestamp = latestTime + step * 5 * 60 * 1000;
    const x = (timestamp - baseTime) / 60000;
    const value = Math.round(Math.max(0, Math.min(400, slope * x + intercept)));
    points.push({ timestamp, value });
  }

  return points;
};

const withFetchTimePoint = (graphData, measurement) => {
  const sorted = sortByTimestamp(graphData);
  const measurementTime = parseApiTimestamp(measurement.Timestamp).getTime();
  const fetchTime = new Date(measurementTime + 20 * 60 * 1000);

  return [
    ...sorted,
    {
      ...sorted[sorted.length - 1],
      Timestamp: toApiTimestampString(fetchTime),
      FactoryTimestamp: toApiTimestampString(fetchTime),
      Value: measurement.Value,
      ValueInMgPerDl: measurement.ValueInMgPerDl,
      type: measurement.type,
      TrendArrow: measurement.TrendArrow,
      TrendMessage: measurement.TrendMessage,
      MeasurementColor: measurement.MeasurementColor,
      GlucoseUnits: measurement.GlucoseUnits,
      isHigh: measurement.isHigh,
      isLow: measurement.isLow,
    },
  ];
};

const withMeasurementTimestampPoint = (graphData, measurement) => {
  const sorted = sortByTimestamp(graphData);
  return [
    ...sorted,
    {
      ...sorted[sorted.length - 1],
      Timestamp: measurement.Timestamp,
      FactoryTimestamp: measurement.FactoryTimestamp,
      Value: measurement.Value,
      ValueInMgPerDl: measurement.ValueInMgPerDl,
      type: measurement.type,
      TrendArrow: measurement.TrendArrow,
      TrendMessage: measurement.TrendMessage,
      MeasurementColor: measurement.MeasurementColor,
      GlucoseUnits: measurement.GlucoseUnits,
      isHigh: measurement.isHigh,
      isLow: measurement.isLow,
    },
  ];
};

const createScales = (actualPoints, projectionPoints) => {
  const allPoints = [
    ...actualPoints.map((item) => ({
      time: parseApiTimestamp(item.Timestamp).getTime(),
      value: item.Value,
    })),
    ...projectionPoints.map((item) => ({
      time: item.timestamp,
      value: item.value,
    })),
  ];

  const minTime = Math.min(...allPoints.map((point) => point.time));
  const maxTime = Math.max(...allPoints.map((point) => point.time));
  const minValue = Math.min(...allPoints.map((point) => point.value));
  const maxValue = Math.max(...allPoints.map((point) => point.value));

  const x = (value) => {
    const usableWidth = chartWidth - margin.left - margin.right;
    return (
      margin.left + ((value - minTime) / (maxTime - minTime)) * usableWidth
    );
  };

  const y = (value) => {
    const usableHeight = chartHeight - margin.top - margin.bottom;
    return (
      chartHeight -
      margin.bottom -
      ((value - (minValue - 10)) / (maxValue - minValue + 20)) * usableHeight
    );
  };

  return { x, y, minTime, maxTime, minValue, maxValue };
};

const linePath = (points, x, y, getTime, getValue) => {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(getTime(point)).toFixed(2)} ${y(getValue(point)).toFixed(2)}`,
    )
    .join(" ");
};

const renderChart = (
  elementId,
  actualPoints,
  projectionPoints,
  accentColor,
) => {
  const svg = document.getElementById(elementId);
  svg.replaceChildren();

  const { x, y, minTime, maxTime, minValue, maxValue } = createScales(
    actualPoints,
    projectionPoints,
  );
  const gridValues = [
    minValue - 10,
    minValue + 20,
    minValue + 50,
    minValue + 80,
    maxValue + 10,
  ];

  gridValues.forEach((value) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(margin.left));
    line.setAttribute("x2", String(chartWidth - margin.right));
    line.setAttribute("y1", String(y(value)));
    line.setAttribute("y2", String(y(value)));
    line.setAttribute("stroke", "#484848");
    line.setAttribute("stroke-dasharray", "4 4");
    svg.appendChild(line);
  });

  const actualPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  actualPath.setAttribute(
    "d",
    linePath(
      actualPoints,
      x,
      y,
      (point) => parseApiTimestamp(point.Timestamp).getTime(),
      (point) => point.Value,
    ),
  );
  actualPath.setAttribute("fill", "none");
  actualPath.setAttribute("stroke", "#ff9800");
  actualPath.setAttribute("stroke-width", "3");
  svg.appendChild(actualPath);

  const projectionPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  const fullProjectionPoints = [
    {
      timestamp: parseApiTimestamp(
        actualPoints[actualPoints.length - 1].Timestamp,
      ).getTime(),
      value: actualPoints[actualPoints.length - 1].Value,
    },
    ...projectionPoints,
  ];
  projectionPath.setAttribute(
    "d",
    linePath(
      fullProjectionPoints,
      x,
      y,
      (point) => point.timestamp,
      (point) => point.value,
    ),
  );
  projectionPath.setAttribute("fill", "none");
  projectionPath.setAttribute("stroke", "#ffb84d");
  projectionPath.setAttribute("stroke-width", "2.5");
  projectionPath.setAttribute("stroke-dasharray", "8 6");
  svg.appendChild(projectionPath);

  const finalPoint = actualPoints[actualPoints.length - 1];
  const finalCircle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  finalCircle.setAttribute(
    "cx",
    String(x(parseApiTimestamp(finalPoint.Timestamp).getTime())),
  );
  finalCircle.setAttribute("cy", String(y(finalPoint.Value)));
  finalCircle.setAttribute("r", "5");
  finalCircle.setAttribute("fill", accentColor);
  finalCircle.setAttribute("stroke", "white");
  finalCircle.setAttribute("stroke-width", "1.5");
  svg.appendChild(finalCircle);

  const labels = [minTime, maxTime];
  labels.forEach((time) => {
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    label.textContent = new Date(time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    label.setAttribute("x", String(x(time)));
    label.setAttribute("y", String(chartHeight - 8));
    label.setAttribute("fill", "#b4b4b4");
    label.setAttribute("font-size", "12");
    label.setAttribute("text-anchor", time === minTime ? "start" : "end");
    svg.appendChild(label);
  });
};

const renderMeta = (payload, brokenPoints, fixedPoints) => {
  const meta = document.getElementById("meta");
  const lastGraphPoint =
    payload.data.graphData[payload.data.graphData.length - 1];
  const measurement = payload.data.connection.glucoseMeasurement;

  const cards = [
    [
      "Last graph point",
      `${lastGraphPoint.Timestamp} | ${lastGraphPoint.Value} mg/dL`,
    ],
    [
      "Measurement point",
      `${measurement.Timestamp} | ${measurement.Value} mg/dL`,
    ],
    [
      "Broken final point",
      `${brokenPoints[brokenPoints.length - 1].Timestamp} | ${brokenPoints[brokenPoints.length - 1].Value} mg/dL`,
    ],
    [
      "Fixed final point",
      `${fixedPoints[fixedPoints.length - 1].Timestamp} | ${fixedPoints[fixedPoints.length - 1].Value} mg/dL`,
    ],
  ];

  meta.innerHTML = cards
    .map(
      ([title, value]) =>
        `<div class="meta-card"><strong>${title}</strong><span>${value}</span></div>`,
    )
    .join("");
};

const renderTables = (brokenPoints, fixedPoints) => {
  const tables = document.getElementById("tables");
  const makeRows = (items) =>
    items
      .slice(-6)
      .map(
        (item) => `<tr><td>${item.Timestamp}</td><td>${item.Value}</td></tr>`,
      )
      .join("");

  tables.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <table data-testid="broken-table">
        <thead><tr><th colspan="2">Current Behavior</th></tr><tr><th>Timestamp</th><th>Value</th></tr></thead>
        <tbody>${makeRows(brokenPoints)}</tbody>
      </table>
      <table data-testid="fixed-table">
        <thead><tr><th colspan="2">Corrected Behavior</th></tr><tr><th>Timestamp</th><th>Value</th></tr></thead>
        <tbody>${makeRows(fixedPoints)}</tbody>
      </table>
    </div>
  `;
};

const main = async () => {
  const response = await fetch("/graph-data.json", { cache: "no-store" });
  const payload = await response.json();
  const graphData = payload.data.graphData;
  const measurement = payload.data.connection.glucoseMeasurement;

  const brokenPoints = withFetchTimePoint(graphData, measurement);
  const fixedPoints = withMeasurementTimestampPoint(graphData, measurement);

  renderMeta(payload, brokenPoints, fixedPoints);
  renderChart(
    "broken-chart",
    brokenPoints,
    calculateProjection(brokenPoints),
    "#6ec1ff",
  );
  renderChart(
    "fixed-chart",
    fixedPoints,
    calculateProjection(fixedPoints),
    "#8bc34a",
  );
  renderTables(brokenPoints, fixedPoints);
};

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre>${String(error)}</pre>`;
});
