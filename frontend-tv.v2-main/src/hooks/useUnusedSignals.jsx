// src/hooks/useUnusedSignals.js
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../utils/api";

function toId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return v._id.toString();
  return null;
}

export default function useUnusedSignals() {
  const [unusedSignals, setUnusedSignals] = useState([]);
  const [raw, setRaw] = useState({ signals: [], channels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [signalsRes, channelsRes] = await Promise.all([
        api.getSignals(),
        api.listChannelDiagrams(),
      ]);

      const signals = Array.isArray(signalsRes?.data) ? signalsRes.data : [];
      const channels = Array.isArray(channelsRes?.data) ? channelsRes.data : [];

      const usedSet = new Set(
        channels
          .map((ch) => toId(ch?.signal))
          .filter(Boolean)
          .map((id) => id.toString())
      );

      const filtered = signals.filter((s) => !usedSet.has(toId(s?._id)));
      setRaw({ signals, channels });
      setUnusedSignals(filtered);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = useMemo(() => {
    return {
      totalSignals: raw.signals.length,
      totalChannels: raw.channels.length,
      totalUsed: raw.channels.filter((c) => toId(c?.signal)).length,
      totalUnused: unusedSignals.length,
    };
  }, [raw, unusedSignals]);

  return { unusedSignals, stats, loading, error, refetch: fetchAll };
}
