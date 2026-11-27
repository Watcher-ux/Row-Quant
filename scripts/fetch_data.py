#!/usr/bin/env python3
"""
Fetch historical OHLCV data for Row-Quant backtesting.

Downloads 10 years of daily data for 100 large-cap S&P 500 stocks
across all 11 GICS sectors using yfinance.

Output: public/data/market.json
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
import numpy as np

# Date range constants
END_DATE = "2026-11-20"
START_DATE = "2016-11-20"  # 10 years before END_DATE


# Universe: 100 large-cap S&P 500 stocks across 11 GICS sectors
# Selected as of 2024 based on market cap and sector representation
UNIVERSE = [
    # Energy (3)
    ("XOM", "Energy"),
    ("CVX", "Energy"),
    ("COP", "Energy"),
    
    # Materials (3)
    ("LIN", "Materials"),
    ("APD", "Materials"),
    ("ECL", "Materials"),
    
    # Industrials (10)
    ("UNP", "Industrials"),
    ("HON", "Industrials"),
    ("UPS", "Industrials"),
    ("RTX", "Industrials"),
    ("BA", "Industrials"),
    ("CAT", "Industrials"),
    ("DE", "Industrials"),
    ("GE", "Industrials"),
    ("MMM", "Industrials"),
    ("LMT", "Industrials"),
    
    # Consumer Discretionary (12)
    ("AMZN", "Consumer Discretionary"),
    ("TSLA", "Consumer Discretionary"),
    ("HD", "Consumer Discretionary"),
    ("MCD", "Consumer Discretionary"),
    ("NKE", "Consumer Discretionary"),
    ("SBUX", "Consumer Discretionary"),
    ("TGT", "Consumer Discretionary"),
    ("LOW", "Consumer Discretionary"),
    ("TJX", "Consumer Discretionary"),
    ("BKNG", "Consumer Discretionary"),
    ("CMG", "Consumer Discretionary"),
    ("MAR", "Consumer Discretionary"),
    
    # Consumer Staples (8)
    ("WMT", "Consumer Staples"),
    ("PG", "Consumer Staples"),
    ("COST", "Consumer Staples"),
    ("KO", "Consumer Staples"),
    ("PEP", "Consumer Staples"),
    ("PM", "Consumer Staples"),
    ("MO", "Consumer Staples"),
    ("CL", "Consumer Staples"),
    
    # Health Care (14)
    ("UNH", "Health Care"),
    ("JNJ", "Health Care"),
    ("LLY", "Health Care"),
    ("ABBV", "Health Care"),
    ("MRK", "Health Care"),
    ("TMO", "Health Care"),
    ("ABT", "Health Care"),
    ("DHR", "Health Care"),
    ("PFE", "Health Care"),
    ("BMY", "Health Care"),
    ("AMGN", "Health Care"),
    ("CVS", "Health Care"),
    ("MDT", "Health Care"),
    ("GILD", "Health Care"),
    
    # Financials (13)
    ("BRK-B", "Financials"),
    ("JPM", "Financials"),
    ("V", "Financials"),
    ("MA", "Financials"),
    ("BAC", "Financials"),
    ("WFC", "Financials"),
    ("MS", "Financials"),
    ("GS", "Financials"),
    ("SPGI", "Financials"),
    ("BLK", "Financials"),
    ("C", "Financials"),
    ("AXP", "Financials"),
    ("SCHW", "Financials"),
    
    # Information Technology (20)
    ("AAPL", "Information Technology"),
    ("MSFT", "Information Technology"),
    ("NVDA", "Information Technology"),
    ("AVGO", "Information Technology"),
    ("ORCL", "Information Technology"),
    ("CRM", "Information Technology"),
    ("CSCO", "Information Technology"),
    ("ADBE", "Information Technology"),
    ("ACN", "Information Technology"),
    ("AMD", "Information Technology"),
    ("IBM", "Information Technology"),
    ("INTC", "Information Technology"),
    ("TXN", "Information Technology"),
    ("QCOM", "Information Technology"),
    ("INTU", "Information Technology"),
    ("NOW", "Information Technology"),
    ("AMAT", "Information Technology"),
    ("MU", "Information Technology"),
    ("ADI", "Information Technology"),
    ("LRCX", "Information Technology"),
    
    # Communication Services (7)
    ("GOOGL", "Communication Services"),
    ("META", "Communication Services"),
    ("NFLX", "Communication Services"),
    ("DIS", "Communication Services"),
    ("CMCSA", "Communication Services"),
    ("T", "Communication Services"),
    ("VZ", "Communication Services"),
    
    # Utilities (3)
    ("NEE", "Utilities"),
    ("DUK", "Utilities"),
    ("SO", "Utilities"),
    
    # Real Estate (7)
    ("AMT", "Real Estate"),
    ("PLD", "Real Estate"),
    ("CCI", "Real Estate"),
    ("EQIX", "Real Estate"),
    ("PSA", "Real Estate"),
    ("SPG", "Real Estate"),
    ("O", "Real Estate"),
]


def fetch_market_data():
    """
    Fetch 10 years of daily OHLCV data for the universe.
    Returns DataFrame with MultiIndex columns (ticker, field).
    """
    tickers = [t[0] for t in UNIVERSE]
    
    print(f"Fetching data for {len(tickers)} tickers...")
    print(f"Date range: {START_DATE} to {END_DATE}")
    
    # Download data using yfinance
    # Use adjusted close for accurate returns accounting for splits/dividends
    data = yf.download(
        tickers,
        start=START_DATE,
        end=END_DATE,
        group_by='ticker',
        auto_adjust=False,  # We'll handle adjustment manually
        progress=True
    )
    
    return data, tickers


def process_data(data, tickers):
    """
    Process raw yfinance data into the format needed for Row-Quant.
    
    Returns:
        dates: list of ISO date strings
        fields: dict of field_name -> [days][stocks] arrays
    """
    # Handle single ticker case (yfinance returns different structure)
    if len(tickers) == 1:
        data = pd.DataFrame({tickers[0]: data})
    
    # Get common date index (union of all dates)
    date_index = data.index
    n_days = len(date_index)
    n_stocks = len(tickers)
    
    print(f"\nProcessing {n_days} days × {n_stocks} stocks...")
    
    # Initialize output arrays
    fields = {
        'open': np.full((n_days, n_stocks), np.nan),
        'high': np.full((n_days, n_stocks), np.nan),
        'low': np.full((n_days, n_stocks), np.nan),
        'close': np.full((n_days, n_stocks), np.nan),
        'volume': np.full((n_days, n_stocks), np.nan),
    }
    
    # Process each ticker
    for i, ticker in enumerate(tickers):
        try:
            if len(tickers) == 1:
                ticker_data = data[ticker]
            else:
                ticker_data = data[ticker]
            
            # Use adjusted close to compute adjustment factor
            adj_close = ticker_data['Adj Close']
            close = ticker_data['Close']
            
            # Adjustment factor: adj_close / close
            # Apply this factor to OHLC to get split-adjusted prices
            adj_factor = adj_close / close
            adj_factor = adj_factor.fillna(1.0)  # If both are NaN, factor is 1
            
            # Adjusted OHLC
            fields['open'][:, i] = (ticker_data['Open'] * adj_factor).values
            fields['high'][:, i] = (ticker_data['High'] * adj_factor).values
            fields['low'][:, i] = (ticker_data['Low'] * adj_factor).values
            fields['close'][:, i] = adj_close.values
            
            # Volume (not adjusted)
            fields['volume'][:, i] = ticker_data['Volume'].values
            
        except Exception as e:
            print(f"Warning: Error processing {ticker}: {e}")
            # Arrays already initialized with NaN, so just continue
    
    # Round prices to 4 decimals
    for field in ['open', 'high', 'low', 'close']:
        fields[field] = np.round(fields[field], 4)
    
    # Convert dates to ISO strings
    dates = [d.strftime('%Y-%m-%d') for d in date_index]
    
    return dates, fields


def compute_statistics(dates, fields, tickers):
    """
    Compute and print summary statistics.
    """
    n_days = len(dates)
    n_stocks = len(tickers)
    total_cells = n_days * n_stocks
    
    print(f"\n{'='*60}")
    print("DATA SUMMARY")
    print(f"{'='*60}")
    print(f"Date range: {dates[0]} to {dates[-1]}")
    print(f"Days: {n_days}")
    print(f"Tickers: {n_stocks}")
    print(f"Total cells per field: {total_cells:,}")
    print(f"\nMissing data percentage by field:")
    
    for field_name, field_data in fields.items():
        missing = np.isnan(field_data).sum()
        pct_missing = 100 * missing / total_cells
        print(f"  {field_name:8s}: {pct_missing:5.2f}% ({missing:,} cells)")
    
    print(f"{'='*60}")


def convert_to_json_safe(arr, is_volume=False):
    """
    Convert numpy array to nested list with NaN -> None.
    For volume, also convert to integers.
    """
    result = []
    for row in arr:
        json_row = []
        for val in row:
            if np.isnan(val):
                json_row.append(None)
            elif is_volume:
                json_row.append(int(val))
            else:
                json_row.append(val)
        result.append(json_row)
    return result


def save_json(dates, tickers, sectors, fields, output_path):
    """
    Save data to JSON file in Row-Quant format.
    NaN values are converted to null in JSON.
    """
    # Convert numpy arrays to nested lists with NaN -> None
    fields_json = {}
    for field_name, field_data in fields.items():
        is_volume = (field_name == 'volume')
        fields_json[field_name] = convert_to_json_safe(field_data, is_volume=is_volume)
    
    output = {
        'dates': dates,
        'tickers': tickers,
        'sectors': sectors,
        'fields': fields_json,
    }
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write JSON with allow_nan=False to fail loudly if any NaN slips through
    with open(output_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'), allow_nan=False)
    
    # Get file size
    file_size = output_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"\nOutput written to: {output_path}")
    print(f"File size: {file_size_mb:.2f} MB ({file_size:,} bytes)")


def main():
    """
    Main entry point.
    """
    print("Row-Quant Data Fetcher")
    print("=" * 60)
    
    # Extract tickers and sectors
    tickers = [t[0] for t in UNIVERSE]
    sectors = [t[1] for t in UNIVERSE]
    
    # Verify we have 100 stocks across 11 sectors
    print(f"Universe: {len(tickers)} stocks")
    sector_counts = pd.Series(sectors).value_counts().sort_index()
    print(f"Sectors: {len(sector_counts)}")
    for sector, count in sector_counts.items():
        print(f"  {sector}: {count}")
    
    # Fetch data
    data, tickers = fetch_market_data()
    
    # Process data
    dates, fields = process_data(data, tickers)
    
    # Compute statistics
    compute_statistics(dates, fields, tickers)
    
    # Save to JSON
    output_path = Path(__file__).parent.parent / 'public' / 'data' / 'market.json'
    save_json(dates, tickers, sectors, fields, output_path)
    
    print("\n✓ Data fetch complete!")


if __name__ == '__main__':
    main()
