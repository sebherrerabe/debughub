using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;

public static class DebugProbe
{
    private static readonly HttpClient Client = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(2)
    };

    public static void Probe(string label, object? data = null, Dictionary<string, object?>? meta = null)
    {
        try
        {
            if (Environment.GetEnvironmentVariable("DEBUGHUB_ENABLED") != "1")
            {
                return;
            }

            var sessionId = Environment.GetEnvironmentVariable("DEBUGHUB_SESSION");
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                return;
            }

            var endpoint = Environment.GetEnvironmentVariable("DEBUGHUB_ENDPOINT");
            if (string.IsNullOrWhiteSpace(endpoint))
            {
                return;
            }

            var level = "info";
            string? hypothesisId = null;
            string? loc = null;
            object? tags = null;

            if (meta != null)
            {
                if (meta.TryGetValue("level", out var levelObj) && levelObj is string levelStr && IsAllowedLevel(levelStr))
                {
                    level = levelStr;
                }

                if (meta.TryGetValue("hypothesisId", out var hypothesisObj) && hypothesisObj is string h)
                {
                    hypothesisId = h;
                }

                if (meta.TryGetValue("loc", out var locObj) && locObj is string l)
                {
                    loc = l;
                }

                if (meta.TryGetValue("tags", out var tagsObj))
                {
                    tags = tagsObj;
                }
            }

            var payloadObject = new Dictionary<string, object?>
            {
                ["ts"] = DateTime.UtcNow.ToString("o"),
                ["sessionId"] = sessionId,
                ["label"] = label,
                ["data"] = data,
                ["hypothesisId"] = hypothesisId,
                ["loc"] = loc,
                ["level"] = level,
                ["tags"] = tags,
                ["runtime"] = "csharp"
            };

            var payload = JsonSerializer.Serialize(payloadObject);
            var target = endpoint.TrimEnd('/') + "/event";

            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            Client.PostAsync(target, content).GetAwaiter().GetResult();
        }
        catch
        {
            // Never throw from helper
        }
    }

    public static void DebugProbeEvent(string label, object? data = null, Dictionary<string, object?>? meta = null)
    {
        Probe(label, data, meta);
    }

    private static bool IsAllowedLevel(string level)
    {
        return level == "info" || level == "warn" || level == "error";
    }
}
