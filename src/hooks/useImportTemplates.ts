import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import type { ImportTemplate } from "@/types/api";

export function useImportTemplates(tenantId: string) {
  const { getToken } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ImportTemplate[]>(
        `/api/importaciones/templates?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar templates");
    } finally {
      setLoading(false);
    }
  }, [tenantId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(
    modulo: string,
    nombre: string,
    configJson: string,
  ): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const config = JSON.parse(configJson) as object;
      await apiJson("/api/importaciones/templates", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ tenantId, modulo, nombre, config }),
      });
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar template");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { templates, loading, saving, error, save, reload: load };
}
