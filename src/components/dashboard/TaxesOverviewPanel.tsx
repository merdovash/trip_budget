import type { ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import type { FullTaxSummary } from '../../engine/budgetEngine'
import { COUNTRY_LABELS } from '../../tax/registry'
import {
  getEmploymentCountryLabel,
  getRelocationMode,
  shouldShowSourceCountryTaxes,
} from '../../config/relocationMode'
import type { BudgetSettings } from '../../types/budget'
import { DoubleTaxationPanel } from './DoubleTaxationPanel'
import { GeorgiaTaxDetailPanel } from './GeorgiaTaxDetailPanel'
import { SpainTaxDetailPanel } from './SpainTaxDetailPanel'
import { ThailandTaxDetailPanel } from './ThailandTaxDetailPanel'
import { TaxBreakdown } from './SummaryCards'

interface TaxesOverviewPanelProps {
  taxSummary: FullTaxSummary
  settings: BudgetSettings
  hasIncomes: boolean
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h3>
  )
}

function SectionDivider() {
  return <hr className="my-6 border-slate-100" />
}

export function TaxesOverviewPanel({ taxSummary, settings, hasIncomes }: TaxesOverviewPanelProps) {
  const residenceCountry = COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode
  const relocationMode = getRelocationMode(settings)
  const showSourceTaxes = shouldShowSourceCountryTaxes(settings)
  const employmentLabel = getEmploymentCountryLabel(settings)

  const residenceIncomeTax = taxSummary.residence?.result.incomeTax ?? 0
  const residenceSocial = taxSummary.residence?.result.socialContributions ?? 0
  const residenceTaxTotal = residenceIncomeTax + residenceSocial
  const sourceTaxTotal = showSourceTaxes ? taxSummary.russiaNdflInBase : 0
  const grandTotal = sourceTaxTotal + residenceTaxTotal - taxSummary.foreignTaxCredit

  const hasResidenceBlock = Boolean(taxSummary.residence)
  const hasAnyTaxBlock = hasResidenceBlock || (showSourceTaxes && taxSummary.russiaSalary) || hasIncomes

  if (!hasAnyTaxBlock) return null

  return (
    <div className="space-y-0">
      {/* 1. Налоги в стране работы / родной стране */}
      <section>
        <SectionHeading>
          {relocationMode === 'sole_proprietorship'
            ? 'Налоги у источника дохода'
            : `Налоги в стране работы (${employmentLabel})`}
        </SectionHeading>
        {relocationMode === 'sole_proprietorship' ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-600">
            Способ переезда — ИП в стране проживания. Отдельного налога у источника в стране работы
            нет; доход облагается в {residenceCountry}.
          </p>
        ) : showSourceTaxes && taxSummary.russiaSalary ? (
          <TaxBreakdown
            regimeName="НДФЛ (зарплата в России)"
            effectiveRate={
              taxSummary.russiaSalary.grossAnnual > 0
                ? taxSummary.russiaSalary.ndfl / taxSummary.russiaSalary.grossAnnual
                : 0
            }
            breakdown={taxSummary.russiaSalary.breakdown}
            currency="RUB"
            footer={
              taxSummary.russiaEmployerSocialInBase > 0
                ? `Взносы работодателя ≈ ${formatCurrency(taxSummary.russiaEmployerSocialInBase, settings.baseCurrency)} (информ.)`
                : undefined
            }
            embedded
          />
        ) : (
          <p className="text-sm text-slate-500">
            Нет доходов с налогами у источника в {employmentLabel}. Добавьте зарплату в разделе
            «Доходы».
          </p>
        )}
      </section>

      {hasResidenceBlock && (
        <>
          <SectionDivider />
          {/* 2. Налоги в стране релокации */}
          <section>
            <SectionHeading>Налоги в стране проживания ({residenceCountry})</SectionHeading>
            {taxSummary.residence?.calculator.countryCode === 'ES' ? (
              <SpainTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={taxSummary.residence.result}
                currency={settings.baseCurrency}
                paymentSchedule={taxSummary.spainSchedule?.payments}
                quarterlyGross={taxSummary.spainSchedule?.quarterlyGross}
                embedded
              />
            ) : taxSummary.residence?.calculator.countryCode === 'TH' ? (
              <ThailandTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={taxSummary.residence.result}
                currency={settings.baseCurrency}
                embedded
              />
            ) : taxSummary.residence?.calculator.countryCode === 'GE' ? (
              <GeorgiaTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={taxSummary.residence.result}
                currency={settings.baseCurrency}
                embedded
              />
            ) : (
              <TaxBreakdown
                regimeName={taxSummary.residence!.calculator.name}
                effectiveRate={taxSummary.residence!.result.effectiveRate}
                breakdown={taxSummary.residence!.result.breakdown}
                currency={settings.baseCurrency}
                embedded
              />
            )}
          </section>
        </>
      )}

      {hasIncomes && (
        <>
          <SectionDivider />
          {/* 3. Двойное налогообложение */}
          <section>
            <SectionHeading>
              Двойное налогообложение ({employmentLabel} → {residenceCountry})
            </SectionHeading>
            <DoubleTaxationPanel
              lines={taxSummary.doubleTaxation}
              countryCode={settings.countryCode}
              embedded
            />
          </section>
        </>
      )}

      <SectionDivider />
      {/* 4. Итоговая сумма */}
      <section>
        <SectionHeading>Итого налогов за год</SectionHeading>
        <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
          {showSourceTaxes && sourceTaxTotal > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">НДФЛ в {employmentLabel}</dt>
              <dd className="font-semibold text-slate-900">
                {formatCurrency(sourceTaxTotal, settings.baseCurrency)}
              </dd>
            </div>
          )}
          {hasResidenceBlock && (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Подоходный налог ({residenceCountry})</dt>
                <dd className="font-semibold text-slate-900">
                  {formatCurrency(residenceIncomeTax, settings.baseCurrency)}
                </dd>
              </div>
              {residenceSocial > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Соц. взносы ({residenceCountry})</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatCurrency(residenceSocial, settings.baseCurrency)}
                  </dd>
                </div>
              )}
            </>
          )}
          {taxSummary.foreignTaxCredit > 0 && (
            <div className="flex justify-between gap-4 text-emerald-700">
              <dt>Зачёт НДФЛ РФ</dt>
              <dd className="font-semibold">
                −{formatCurrency(taxSummary.foreignTaxCredit, settings.baseCurrency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
            <dt className="font-medium text-slate-800">Всего к уплате (оценка)</dt>
            <dd className="font-bold text-slate-900">
              {formatCurrency(grandTotal, settings.baseCurrency)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          Суммы в {settings.baseCurrency}. НДФЛ конвертирован по курсу ЦБ. Взносы работодателя в
          РФ не включены в итог.
        </p>
      </section>
    </div>
  )
}
