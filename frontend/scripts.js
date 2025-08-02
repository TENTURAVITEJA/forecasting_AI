let excelData = [];
let excelHeaders = [];
let lastForecastResult = null;
let lastModel = null;
let lastUsedColumn = null;
let lastSteps = 1;

// Handle Excel file upload & parse
document.getElementById("excel_file").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const parsed = XLSX.utils.sheet_to_json(ws, { header: 1 });

    excelHeaders = parsed[0];
    excelData = parsed.slice(1).filter((row) => row.length === excelHeaders.length);

    if (excelHeaders.length > 1) {
      buildTargetColumnSelector(excelHeaders);
    } else {
      document.getElementById("target_column_selector").innerHTML = "";
    }

    document.getElementById("result").innerText = "Excel data loaded. Select target column if applicable.";
  };
  reader.readAsArrayBuffer(file);
});

// Build column selector dropdown for multivariate data
function buildTargetColumnSelector(headers) {
  let html = `<label for="targetCol">Select target column:</label><select id="targetCol">`;
  headers.forEach(
    (h) => (html += `<option value="${h}">${h}</option>`)
  );
  html += "</select>";
  document.getElementById("target_column_selector").innerHTML = html;
}

// Fetch forecast from backend and display results + chart
function runForecast() {
  let dataManual = document.getElementById("inp_data").value.trim();
  let modelChoice = document.getElementById("model_choice").value;
  let steps = parseInt(document.getElementById("steps").value);
  let targetCol = document.getElementById("targetCol")?.value || null;
  let resultDiv = document.getElementById("result");
  let dataToSend = {};
  lastSteps = steps;

  if (excelData.length > 0) {
    if (!targetCol) {
      resultDiv.innerText = "Please select a target column for Excel data.";
      return;
    }
    dataToSend = {
      columns: excelHeaders,
      rows: excelData,
      target_column: targetCol,
      model_choice: modelChoice,
      steps: steps,
    };
  } else if (dataManual.length > 0) {
    let dataArr = dataManual.split(",").map(Number).filter((n) => !isNaN(n));
    if (dataArr.length < 5) {
      resultDiv.innerText = "Please enter at least 5 valid numbers for manual input.";
      return;
    }
    dataToSend = {
      values: dataArr,
      model_choice: modelChoice,
      steps: steps,
    };
  } else {
    resultDiv.innerText = "Please enter data manually or upload an Excel file.";
    return;
  }

  resultDiv.innerText = "Running forecast...";

  fetch("http://localhost:5000/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dataToSend),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.forecast !== undefined) {
        lastForecastResult = data.forecast;
        lastModel = data.model;
        lastUsedColumn = data.used_column;

        let forecastText = `<p><strong>Model Used:</strong> ${data.model}</p>`;
        forecastText += `<p><strong>Target Column:</strong> ${data.used_column}</p>`;
        if (data.forecast.length > 1) {
          forecastText += `<p><strong>Forecast (${data.forecast.length} steps):</strong> [${data.forecast.map(v => v.toFixed(2)).join(", ")}]</p>`;
        } else {
          forecastText += `<p><strong>Forecasted Value:</strong> ${data.forecast[0].toFixed(2)}</p>`;
        }
        resultDiv.innerHTML = forecastText;

        document.getElementById("download_csv_btn").style.display = "inline-block";
        document.getElementById("download_json_btn").style.display = "inline-block";
        drawChart(data.forecast, dataToSend);
      } else {
        resultDiv.innerText = data.error || "Error from backend.";
      }
    })
    .catch(() => {
      resultDiv.innerText = "Backend server unreachable.";
    });
}

// Draw Chart with input + forecast
function drawChart(forecast, dataToSend) {
  const ctx = document.getElementById("forecast_chart").getContext("2d");
  let inputSeries = [];

  if (dataToSend.values) {
    inputSeries = dataToSend.values;
  } else if (dataToSend.rows && dataToSend.columns && dataToSend.target_column) {
    const colIndex = dataToSend.columns.indexOf(dataToSend.target_column);
    inputSeries = dataToSend.rows.map((row) => Number(row[colIndex])).filter((v) => !isNaN(v));
  }

  const totalSeries = [...inputSeries, ...forecast];
  const labels = totalSeries.map((_, i) => `t+${i}`);

  if (window.chartInstance) {
    window.chartInstance.destroy();
  }

  window.chartInstance = new Chart(ctx, {
    type: "line",
     {
      labels: labels,
      datasets: [
        {
          label: "Original + Forecast",
           totalSeries,
          fill: false,
          borderColor: "blue",
          tension: 0.1,
        },
        {
          label: "Original Data",
           inputSeries,
          fill: false,
          borderColor: "green",
          tension: 0.1,
          pointRadius: 3,
        },
        {
          label: "Forecast",
           new Array(inputSeries.length).fill(null).concat(forecast),
          fill: false,
          borderColor: "red",
          borderDash: [5, 5],
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
    },
  });
}

// Download forecast result as CSV or JSON
function downloadResult(format = "csv") {
  if (lastForecastResult === null) return;

  const data = {
    model: lastModel,
    column: lastUsedColumn,
    steps: lastSteps,
    forecast: lastForecastResult,
  };

  let content, mime, filename;
  if (format === "csv") {
    const forecastStr = data.forecast.join ? data.forecast.join(";") : data.forecast;
    content = `Model,Column,Steps,Forecast\n${data.model},${data.column},${data.steps},"${forecastStr}"`;
    mime = "text/csv";
    filename = "forecast_result.csv";
  } else {
    content = JSON.stringify(data, null, 2);
    mime = "application/json";
    filename = "forecast_result.json";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
