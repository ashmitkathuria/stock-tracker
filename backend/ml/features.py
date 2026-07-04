"""
Feature engineering for the price-direction model.

Everything here is causal: every feature for day T is computed only from
rows with date <= T (rolling windows, shifts, expanding stats). The unit
test suite asserts this by truncating the input and re-deriving.

The entry point is `build_features(prices, market=None, vix=None,
sector=None, news=None)` — a pure function of DataFrames that returns the
feature matrix plus `target_1d` / `target_5d` label columns (NaN where the
future is unknown).
"""
import numpy as np
import pandas as pd

# Symbol-agnostic feature columns fed to the model, in stable order.
FEATURE_COLUMNS = [
    # returns
    "ret_1", "ret_2", "ret_5", "ret_10", "ret_20", "log_ret_1",
    # volatility
    "vol_10", "vol_20", "vol_60", "vol_of_vol_20",
    # trend
    "sma_10_50", "sma_50_200", "dist_52w_high", "dist_52w_low",
    # oscillators
    "rsi_14", "macd_hist", "boll_pct_b",
    # volume
    "volume_z_20", "obv_slope_10",
    # gaps & candles
    "overnight_gap", "intraday_range", "close_position",
    # market context
    "nifty_ret_1", "nifty_ret_5", "vix_level", "vix_chg_5", "beta_60",
    "sector_ret_1", "sector_ret_5",
    # news
    "news_sent_3d", "news_count_3d",
    # calendar
    "day_of_week", "month",
]


def _rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / window, min_periods=window).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / window, min_periods=window).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def _macd_hist(close: pd.Series) -> pd.Series:
    ema12 = close.ewm(span=12, min_periods=12).mean()
    ema26 = close.ewm(span=26, min_periods=26).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, min_periods=9).mean()
    # normalize by price so the feature is comparable across symbols
    return (macd - signal) / close


def _bollinger_pct_b(close: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.Series:
    mid = close.rolling(window).mean()
    std = close.rolling(window).std()
    upper, lower = mid + num_std * std, mid - num_std * std
    return (close - lower) / (upper - lower).replace(0, np.nan)


def _obv_slope(close: pd.Series, volume: pd.Series, window: int = 10) -> pd.Series:
    direction = np.sign(close.diff()).fillna(0)
    obv = (direction * volume.fillna(0)).cumsum()
    # slope proxy: change over window, scaled by rolling mean volume
    scale = volume.rolling(window).mean().replace(0, np.nan)
    return obv.diff(window) / (scale * window)


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    """Sort by date, index by date, coerce numerics."""
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"])
    out = out.sort_values("date").set_index("date")
    for col in ("open", "high", "low", "close", "volume"):
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def build_features(prices: pd.DataFrame, market: pd.DataFrame = None,
                   vix: pd.DataFrame = None, sector: pd.DataFrame = None,
                   news: pd.DataFrame = None) -> pd.DataFrame:
    """
    Build the per-day feature matrix for one symbol.

    Args:
        prices: columns date, open, high, low, close, volume
        market: NIFTY50 daily closes (date, close)
        vix: INDIAVIX daily closes (date, close)
        sector: columns date, return_pct (the symbol's sector)
        news: columns published_at (or date) and sentiment_score

    Returns:
        DataFrame indexed by date with FEATURE_COLUMNS plus target_1d /
        target_5d (1 if close rises over the horizon, else 0; NaN at the
        tail where the future is unknown).
    """
    px = _prep(prices)
    close, volume = px["close"], px["volume"]
    f = pd.DataFrame(index=px.index)

    # returns
    for n in (1, 2, 5, 10, 20):
        f[f"ret_{n}"] = close.pct_change(n)
    f["log_ret_1"] = np.log(close / close.shift(1))

    # volatility
    r1 = f["ret_1"]
    for n in (10, 20, 60):
        f[f"vol_{n}"] = r1.rolling(n).std()
    f["vol_of_vol_20"] = f["vol_20"].rolling(20).std()

    # trend
    sma10, sma50 = close.rolling(10).mean(), close.rolling(50).mean()
    sma200 = close.rolling(200, min_periods=120).mean()
    f["sma_10_50"] = sma10 / sma50
    f["sma_50_200"] = sma50 / sma200
    high_52w = close.rolling(252, min_periods=60).max()
    low_52w = close.rolling(252, min_periods=60).min()
    f["dist_52w_high"] = close / high_52w - 1
    f["dist_52w_low"] = close / low_52w - 1

    # oscillators
    f["rsi_14"] = _rsi(close) / 100.0
    f["macd_hist"] = _macd_hist(close)
    f["boll_pct_b"] = _bollinger_pct_b(close)

    # volume
    vmean, vstd = volume.rolling(20).mean(), volume.rolling(20).std()
    f["volume_z_20"] = (volume - vmean) / vstd.replace(0, np.nan)
    f["obv_slope_10"] = _obv_slope(close, volume)

    # gaps & candles
    f["overnight_gap"] = px["open"] / close.shift(1) - 1
    f["intraday_range"] = (px["high"] - px["low"]) / close
    rng = (px["high"] - px["low"]).replace(0, np.nan)
    f["close_position"] = (close - px["low"]) / rng

    # market context (as-of join so a missing market day never looks ahead)
    if market is not None and len(market) > 0:
        mkt = _prep(market)["close"]
        mkt_ret_1, mkt_ret_5 = mkt.pct_change(1), mkt.pct_change(5)
        f["nifty_ret_1"] = mkt_ret_1.reindex(f.index, method="ffill")
        f["nifty_ret_5"] = mkt_ret_5.reindex(f.index, method="ffill")
        aligned_mkt = mkt_ret_1.reindex(f.index, method="ffill")
        cov = r1.rolling(60).cov(aligned_mkt)
        var = aligned_mkt.rolling(60).var()
        f["beta_60"] = cov / var.replace(0, np.nan)
    else:
        f["nifty_ret_1"] = f["nifty_ret_5"] = f["beta_60"] = np.nan

    if vix is not None and len(vix) > 0:
        vx = _prep(vix)["close"]
        f["vix_level"] = (vx / 100.0).reindex(f.index, method="ffill")
        f["vix_chg_5"] = vx.pct_change(5).reindex(f.index, method="ffill")
    else:
        f["vix_level"] = f["vix_chg_5"] = np.nan

    if sector is not None and len(sector) > 0:
        sec = sector.copy()
        sec["date"] = pd.to_datetime(sec["date"])
        sec = sec.sort_values("date").set_index("date")["return_pct"].astype(float) / 100.0
        f["sector_ret_1"] = sec.reindex(f.index, method="ffill")
        f["sector_ret_5"] = sec.rolling(5).sum().reindex(f.index, method="ffill")
    else:
        f["sector_ret_1"] = f["sector_ret_5"] = np.nan

    # news: trailing 3-day mean sentiment and count (strictly <= day T)
    if news is not None and len(news) > 0:
        nw = news.copy()
        dcol = "published_at" if "published_at" in nw.columns else "date"
        nw["day"] = pd.to_datetime(nw[dcol]).dt.normalize()
        daily = nw.groupby("day")["sentiment_score"].agg(["mean", "count"])
        daily = daily.reindex(pd.date_range(f.index.min(), f.index.max(), freq="D"))
        sent_3d = daily["mean"].rolling(3, min_periods=1).mean()
        count_3d = daily["count"].fillna(0).rolling(3, min_periods=1).sum()
        f["news_sent_3d"] = sent_3d.reindex(f.index).astype(float)
        f["news_count_3d"] = count_3d.reindex(f.index).astype(float)
    else:
        f["news_sent_3d"] = np.nan
        f["news_count_3d"] = 0.0

    # calendar
    f["day_of_week"] = f.index.dayofweek.astype(float)
    f["month"] = f.index.month.astype(float)

    # neutral fills for context features a symbol may legitimately lack
    for col in ("news_sent_3d", "sector_ret_1", "sector_ret_5"):
        f[col] = f[col].fillna(0.0)

    # targets (future — NaN at the tail, dropped before training)
    f["target_1d"] = (close.shift(-1) > close).astype(float).where(close.shift(-1).notna())
    f["target_5d"] = (close.shift(-5) > close).astype(float).where(close.shift(-5).notna())

    f["close"] = close
    return f
