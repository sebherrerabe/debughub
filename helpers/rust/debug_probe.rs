use std::env;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub struct Meta {
    pub hypothesis_id: Option<String>,
    pub loc: Option<String>,
    pub level: Option<String>,
    pub tags_json: Option<String>,
}

pub fn debug_probe(label: &str, data_json: Option<&str>, meta: Option<Meta>) {
    let _ = run_debug_probe(label, data_json, meta);
}

#[allow(non_snake_case)]
pub fn debugProbe(label: &str, data_json: Option<&str>, meta: Option<Meta>) {
    debug_probe(label, data_json, meta);
}

fn run_debug_probe(label: &str, data_json: Option<&str>, meta: Option<Meta>) -> Result<(), String> {
    if env::var("DEBUGHUB_ENABLED").unwrap_or_default() != "1" {
        return Ok(());
    }

    let session_id = env::var("DEBUGHUB_SESSION").unwrap_or_default();
    if session_id.is_empty() {
        return Ok(());
    }

    let endpoint = env::var("DEBUGHUB_ENDPOINT").unwrap_or_default();
    if endpoint.is_empty() {
        return Ok(());
    }

    let parsed = parse_http_endpoint(&endpoint)?;
    let path = append_event_path(&parsed.base_path);
    let level = normalize_level(meta.as_ref().and_then(|m| m.level.as_ref()));
    let hypothesis_id = meta.as_ref().and_then(|m| m.hypothesis_id.as_ref());
    let loc = meta.as_ref().and_then(|m| m.loc.as_ref());
    let tags_json = meta.as_ref().and_then(|m| m.tags_json.as_ref());

    let payload = format!(
        "{{\"ts\":\"{}\",\"sessionId\":\"{}\",\"label\":\"{}\",\"data\":{},\"hypothesisId\":{},\"loc\":{},\"level\":\"{}\",\"tags\":{},\"runtime\":\"rust\"}}",
        iso_time_now(),
        escape_json(&session_id),
        escape_json(label),
        data_json.unwrap_or("null"),
        as_json_string_or_null(hypothesis_id),
        as_json_string_or_null(loc),
        level,
        tags_json.map(|t| t.as_str()).unwrap_or("null"),
    );

    send_http_post(&parsed.host, parsed.port, &path, &payload)?;
    Ok(())
}

struct ParsedEndpoint {
    host: String,
    port: u16,
    base_path: String,
}

fn parse_http_endpoint(endpoint: &str) -> Result<ParsedEndpoint, String> {
    if !endpoint.starts_with("http://") {
        return Err("unsupported endpoint scheme".to_string());
    }

    let rest = &endpoint[7..];
    let (host_port, path_part) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, ""),
    };

    if host_port.is_empty() {
        return Err("missing host".to_string());
    }

    let (host, port) = match host_port.rsplit_once(':') {
        Some((h, p)) => {
            let parsed_port = p.parse::<u16>().map_err(|_| "invalid port".to_string())?;
            (h.to_string(), parsed_port)
        }
        None => (host_port.to_string(), 80),
    };

    if host.is_empty() {
        return Err("missing host".to_string());
    }

    Ok(ParsedEndpoint {
        host,
        port,
        base_path: path_part.to_string(),
    })
}

fn append_event_path(base_path: &str) -> String {
    if base_path.is_empty() {
        return "/event".to_string();
    }
    if base_path.ends_with('/') {
        return format!("{}event", base_path);
    }
    format!("{}/event", base_path)
}

fn send_http_post(host: &str, port: u16, path: &str, payload: &str) -> Result<(), String> {
    let mut stream = TcpStream::connect((host, port)).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;

    let request = format!(
        "POST {} HTTP/1.1\r\nHost: {}:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path,
        host,
        port,
        payload.len(),
        payload
    );

    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
    let _ = stream.flush();

    let mut buf = [0_u8; 256];
    let _ = stream.read(&mut buf);
    Ok(())
}

fn normalize_level(level: Option<&String>) -> &'static str {
    match level {
        Some(v) if v == "warn" => "warn",
        Some(v) if v == "error" => "error",
        _ => "info",
    }
}

fn as_json_string_or_null(value: Option<&String>) -> String {
    match value {
        Some(v) => format!("\"{}\"", escape_json(v)),
        None => "null".to_string(),
    }
}

fn escape_json(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('\"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn iso_time_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0));
    let total_seconds = now.as_secs() as i64;
    let millis = now.subsec_millis();
    let days_since_epoch = total_seconds.div_euclid(86_400);
    let seconds_of_day = total_seconds.rem_euclid(86_400);

    let (year, month, day) = civil_from_days(days_since_epoch);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hour, minute, second, millis
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    // Convert days since Unix epoch (1970-01-01) into UTC calendar date.
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if month <= 2 { 1 } else { 0 };

    (year as i32, month as u32, day as u32)
}
