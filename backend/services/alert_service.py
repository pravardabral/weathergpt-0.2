import httpx
import asyncio
from typing import List, Dict

active_webhooks: List[Dict] = []

async def resolve_district(lat: float, lon: float, fallback_name: str) -> str:
    """
    Reverse-geocodes coordinates to get the exact parent District (e.g., Tehri Garhwal)
    to match IMD's district-level alerts.
    """
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&addressdetails=1"
    try:
        async with httpx.AsyncClient() as client:
            headers = {"User-Agent": "WeatherGPT-Backend/1.0"}
            res = await client.get(url, headers=headers, timeout=5.0)
            if res.status_code == 200:
                address = res.json().get("address", {})
                district = address.get("state_district", address.get("county", ""))
                if district:
                    return district.lower().replace(" district", "").strip()
    except Exception:
        pass
    return fallback_name.lower()

async def fetch_imd_district_warning(location_name: str, lat: float, lon: float) -> List[Dict]:
    alerts = []
    
    # 1. Translate coordinates to exact district name
    district_name = await resolve_district(lat, lon, location_name)
    search_terms = [location_name.lower(), district_name]
    
    url_json = "https://mausam.imd.gov.in/api/warnings_district_api.php"
    url_wfs = "https://reactjs.imd.gov.in/geoserver/wfs"
    params_wfs = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "imd:Warnings_StateDistrict_Merged",
        "outputFormat": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # Try Strategy 1: JSON API
        try:
            res = await client.get(url_json, timeout=8.0)
            if res.status_code == 200:
                for item in res.json():
                    dist = str(item.get("district_name", item.get("district", ""))).lower()
                    if dist and any(term in dist for term in search_terms if term):
                        color = str(item.get("colorcode", item.get("color", ""))).lower()
                        warn = item.get("warning", item.get("warn", "Active weather watch."))
                        
                        if color and color not in ["green", "none", "", "null"]:
                            severity = "Extreme" if color == "red" else "High" if color == "orange" else "Moderate"
                            alerts.append({
                                "title": f"IMD {color.capitalize()} Alert: {dist.title()}",
                                "description": warn,
                                "severity": severity,
                                "source": "IMD District JSON"
                            })
                            return alerts
        except Exception:
            pass 
            
        # Try Strategy 2: WFS Map Layer
        try:
            res = await client.get(url_wfs, params=params_wfs, timeout=12.0)
            if res.status_code == 200:
                features = res.json().get("features", [])
                for feature in features:
                    props = feature.get("properties", {})
                    dist = str(props.get("DISTRICT", props.get("district", ""))).lower()
                    
                    if dist and any(term in dist for term in search_terms if term):
                        color = str(props.get("Day1_Color", props.get("day1_color", ""))).lower()
                        warn = props.get("Day1_Warn", props.get("day1_warn", "Conditions are being monitored."))
                        
                        if color and color not in ["green", "none", "", "null"]:
                            severity = "Extreme" if color == "red" else "High" if color == "orange" else "Moderate"
                            alerts.append({
                                "title": f"IMD {color.capitalize()} Alert: {dist.title()}",
                                "description": warn,
                                "severity": severity,
                                "source": "IMD GIS Map"
                            })
                            return alerts
        except Exception as e:
            pass
            
    return alerts

async def get_all_active_alerts(location_name: str, lat: float, lon: float) -> List[Dict]:
    imd_district_alerts = await fetch_imd_district_warning(location_name, lat, lon)
    return active_webhooks + imd_district_alerts