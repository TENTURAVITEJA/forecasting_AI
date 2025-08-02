from flask import Flask, request, jsonify
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
import numpy as np
import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor

app = Flask(__name__)

def fit_arima(series, steps=1):
    model = ARIMA(series, order=(1,1,1))
    model_fit = model.fit()
    forecast = model_fit.forecast(steps).tolist()
    return forecast, "ARIMA(1,1,1)"

def fit_xgboost(series, steps=1):
    # Simple supervised learning framing for time series
    X, y = [], []
    for i in range(len(series)-1):
        X.append([series[i]])
        y.append(series[i+1])
    model = xgb.XGBRegressor(objective='reg:squarederror')
    model.fit(X, y)
    last_val = series[-1]
    preds = []
    for _ in range(steps):
        pred = model.predict([[last_val]])[0]
        preds.append(pred)
        last_val = pred
    return preds, "XGBoost"

def fit_random_forest(series, steps=1):
    X, y = [], []
    for i in range(len(series)-1):
        X.append([series[i]])
        y.append(series[i+1])
    model = RandomForestRegressor()
    model.fit(X, y)
    last_val = series[-1]
    preds = []
    for _ in range(steps):
        pred = model.predict([[last_val]])[0]
        preds.append(pred)
        last_val = pred
    return preds, "Random Forest"

@app.route('/forecast', methods=['POST'])
def forecast():
    try:
        data = request.get_json()
        steps = int(data.get("steps", 1))
        model_choice = data.get("model_choice", "auto")
        
        # Multivariate data handling
        if "rows" in data and "columns" in data and "target_column" in 
            df = pd.DataFrame(data["rows"], columns=data["columns"])
            target_col = data["target_column"]
            if target_col not in df.columns:
                return jsonify({"error": f"Column '{target_col}' not found."}), 400
            series = pd.to_numeric(df[target_col], errors='coerce').dropna()
            if len(series) < 10:
                return jsonify({"error": "Not enough valid data points to forecast."}), 400

        # Univariate data handling
        elif "values" in 
            series = pd.Series(data["values"]).dropna()
            series = pd.to_numeric(series, errors='coerce').dropna()
            if len(series) < 5:
                return jsonify({"error": "Provide at least 5 numeric values."}), 400
            target_col = "unnamed_series"
        else:
            return jsonify({"error": "Invalid data format"}), 400
        
        # Model selection
        if model_choice == "arima":
            forecast_values, model_used = fit_arima(series, steps)
        elif model_choice == "xgboost":
            forecast_values, model_used = fit_xgboost(series, steps)
        elif model_choice == "rf":
            forecast_values, model_used = fit_random_forest(series, steps)
        else:  # auto - pick best model (here just ARIMA for demo)
            forecast_values, model_used = fit_arima(series, steps)
        
        return jsonify({
            "model": model_used,
            "used_column": target_col,
            "forecast": forecast_values
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
