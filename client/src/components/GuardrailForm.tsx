import { useState } from "react";
import {
  ALL_RISK_PROFILES,
  ALL_SECTORS,
  RISK_PROFILE_HINTS,
  RISK_PROFILE_LABELS,
  SECTOR_LABELS,
  type GuardrailSettings,
  type ModelChoice,
  type RiskProfile,
  type Sector,
} from "../api";

interface Props {
  settings: GuardrailSettings;
  onSave: (settings: GuardrailSettings) => Promise<void>;
  disabled: boolean;
}

export function GuardrailForm({ settings, onSave, disabled }: Props) {
  const [form, setForm] = useState<GuardrailSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.allSectorsDelegated && form.sectors.length === 0) {
      setError("최소 1개 분야를 선택하거나 전체 위임을 켜주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Guardrail 설정</h2>

      <label>
        투자금 (USD)
        <input
          type="number"
          min={0}
          value={form.investmentAmount}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, investmentAmount: Number(e.target.value) })
          }
        />
      </label>

      <label>
        손실 한도 (USD)
        <input
          type="number"
          min={0}
          value={form.lossLimit}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, lossLimit: Number(e.target.value) })}
        />
      </label>

      <label>
        API 비용 한도 (USD, 최대 $10)
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={form.costLimitUsd}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, costLimitUsd: Number(e.target.value) })
          }
        />
      </label>

      <div className="field-label">투자 분야</div>
      <div className="sector-grid">
        {ALL_SECTORS.map((sector) => (
          <label key={sector} className="sector-option">
            <input
              type="checkbox"
              checked={form.sectors.includes(sector)}
              disabled={disabled || form.allSectorsDelegated}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...form.sectors, sector]
                  : form.sectors.filter((s) => s !== sector);
                setForm({ ...form, sectors: next });
              }}
            />
            {SECTOR_LABELS[sector]}
          </label>
        ))}
      </div>

      <label className="permission-option">
        <input
          type="checkbox"
          checked={form.allSectorsDelegated}
          disabled={disabled}
          onChange={(e) =>
            setForm({
              ...form,
              allSectorsDelegated: e.target.checked,
              sectors: e.target.checked ? (ALL_SECTORS as Sector[]) : form.sectors,
            })
          }
        />
        전체 위임 — 분야 제한 없이 AI에게 전 종목 판단 권한을 맡깁니다
      </label>

      <label className="permission-option">
        <input
          type="checkbox"
          checked={form.allowSell}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, allowSell: e.target.checked })}
        />
        매도 권한 부여 — 끄면 AI는 매수/보류만 가능하고 보유 종목을 팔 수 없습니다
      </label>

      <label>
        AI 모델
        <select
          value={form.model}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, model: e.target.value as ModelChoice })
          }
        >
          <option value="claude-haiku-4-5">Haiku 4.5 (저비용)</option>
          <option value="claude-sonnet-5">Sonnet 5 (고품질)</option>
        </select>
      </label>

      <label>
        실행 주기 (분)
        <input
          type="number"
          min={1}
          value={form.cycleIntervalMinutes}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, cycleIntervalMinutes: Number(e.target.value) })
          }
        />
      </label>

      <label>
        최대 실행 시간 (시간, 비워두면 무제한)
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder="예: 3"
          value={form.maxRuntimeHours ?? ""}
          disabled={disabled}
          onChange={(e) =>
            setForm({
              ...form,
              maxRuntimeHours:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>

      <label>
        종목당 최대 비중 (%, 분산 투자 강제)
        <input
          type="number"
          min={1}
          max={100}
          value={form.maxPositionPct}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, maxPositionPct: Number(e.target.value) })
          }
        />
      </label>

      <div className="field-label">투자 성향</div>
      <div className="risk-profile-grid">
        {ALL_RISK_PROFILES.map((profile) => (
          <label
            key={profile}
            className={
              form.riskProfile === profile ? "risk-profile-option risk-profile-selected" : "risk-profile-option"
            }
          >
            <input
              type="radio"
              name="riskProfile"
              checked={form.riskProfile === profile}
              disabled={disabled}
              onChange={() => setForm({ ...form, riskProfile: profile as RiskProfile })}
            />
            <span className="risk-profile-name">{RISK_PROFILE_LABELS[profile]}</span>
          </label>
        ))}
      </div>
      <p className="hint">{RISK_PROFILE_HINTS[form.riskProfile]}</p>

      <button type="submit" disabled={disabled || saving}>
        {saving ? "저장 중..." : "설정 저장"}
      </button>
      {error && <p className="error">{error}</p>}
      {disabled && (
        <p className="hint">에이전트 실행 중에는 설정을 변경할 수 없습니다.</p>
      )}
    </form>
  );
}
