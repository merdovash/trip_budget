import type { ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import { getCountryLocalCurrency } from '../../config/foodBudget'
import {
  convertAmountFromBase,
  convertScheduledPaymentsFromBase,
  convertTaxResultFromBase,
} from '../../lib/taxCurrencyDisplay'
import type { FullTaxSummary, YearTaxSummary } from '../../engine/budgetEngine'
import { yearTaxTotalInBase } from '../../engine/budgetEngine'
import { COUNTRY_LABELS } from '../../tax/registry'
import {
  getEmploymentCountryCurrency,
  getEmploymentCountryLabel,
  getRelocationMode,
  shouldShowSourceCountryTaxes,
} from '../../config/relocationMode'
import type { BudgetSettings } from '../../types/budget'
import { LocalCurrencyWithBaseHint, residenceTaxDisplayNote } from '../ui/LocalCurrencyWithBaseHint'
import { DoubleTaxationPanel } from './DoubleTaxationPanel'
import { GeorgiaTaxDetailPanel } from './GeorgiaTaxDetailPanel'
import { SpainTaxDetailPanel } from './SpainTaxDetailPanel'
import { ThailandTaxDetailPanel } from './ThailandTaxDetailPanel'
import { TaxBreakdown } from './SummaryCards'

interface YearTaxBlockProps {
  taxSummary: FullTaxSummary
  settings: BudgetSettings
  hasIncomes: boolean
  showGrandTotalFooter: boolean
  yearLabel?: string
}

interface TaxesOverviewPanelProps {
  yearSummaries: YearTaxSummary[]
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

function YearTaxBlock({
  taxSummary,
  settings,
  hasIncomes,
  showGrandTotalFooter,
  yearLabel,
}: YearTaxBlockProps) {
  const residenceCountry = COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode
  const relocationMode = getRelocationMode(settings)
  const showSourceTaxes = shouldShowSourceCountryTaxes(settings)
  const employmentLabel = getEmploymentCountryLabel(settings)
  const sourceCurrency = getEmploymentCountryCurrency(settings)
  const baseCurrency = settings.baseCurrency
  const residenceLocalCurrency = getCountryLocalCurrency(settings.countryCode)

  const residenceIncomeTax = taxSummary.residence?.result.incomeTax ?? 0
  const residenceSocial = taxSummary.residence?.result.socialContributions ?? 0
  const residenceTaxTotal = residenceIncomeTax + residenceSocial
  const sourceTaxTotalNative =
    showSourceTaxes && taxSummary.russiaSalary ? taxSummary.russiaSalary.ndfl : 0
  const grandTotalInBase =
    (showSourceTaxes ? taxSummary.russiaNdflInBase : 0) + residenceTaxTotal

  const residenceResultForDisplay =
    taxSummary.residence &&
    convertTaxResultFromBase(taxSummary.residence.result, baseCurrency, residenceLocalCurrency)
  const spainPaymentsForDisplay = taxSummary.spainSchedule?.payments
    ? convertScheduledPaymentsFromBase(
        taxSummary.spainSchedule.payments,
        baseCurrency,
        residenceLocalCurrency,
      )
    : undefined
  const residenceDisplayNote = residenceTaxDisplayNote(residenceLocalCurrency, baseCurrency)
  const foreignTaxCreditLocal = convertAmountFromBase(
    taxSummary.foreignTaxCredit,
    baseCurrency,
    residenceLocalCurrency,
  )

  const hasResidenceBlock = Boolean(taxSummary.residence)
  const hasAnyTaxBlock = hasResidenceBlock || (showSourceTaxes && taxSummary.russiaSalary) || hasIncomes

  if (!hasAnyTaxBlock) return null

  return (
    <div className="space-y-0">
      {yearLabel && (
        <h3 className="mb-4 text-base font-semibold text-slate-900">{yearLabel}</h3>
      )}

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
          <section>
            <SectionHeading>Налоги в стране проживания ({residenceCountry})</SectionHeading>
            {taxSummary.residence?.calculator.countryCode === 'ES' ? (
              <SpainTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={residenceResultForDisplay!}
                currency={residenceLocalCurrency}
                paymentSchedule={spainPaymentsForDisplay}
                quarterlyGross={taxSummary.spainSchedule?.quarterlyGross}
                embedded
                footer={residenceDisplayNote ?? undefined}
              />
            ) : taxSummary.residence?.calculator.countryCode === 'TH' ? (
              <ThailandTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={residenceResultForDisplay!}
                currency={residenceLocalCurrency}
                embedded
                footer={residenceDisplayNote ?? undefined}
              />
            ) : taxSummary.residence?.calculator.countryCode === 'GE' ? (
              <GeorgiaTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={residenceResultForDisplay!}
                currency={residenceLocalCurrency}
                embedded
                footer={residenceDisplayNote ?? undefined}
              />
            ) : (
              <TaxBreakdown
                regimeName={taxSummary.residence!.calculator.name}
                effectiveRate={taxSummary.residence!.result.effectiveRate}
                breakdown={residenceResultForDisplay!.breakdown}
                currency={residenceLocalCurrency}
                footer={residenceDisplayNote ?? undefined}
                embedded
              />
            )}
          </section>
        </>
      )}

      {hasIncomes && (
        <>
          <SectionDivider />
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
      <section>
        <SectionHeading>
          {showGrandTotalFooter ? 'Итого налогов за год' : `Итого за ${yearLabel ?? 'год'}`}
        </SectionHeading>
        <dl className="space-y-3">
          {showSourceTaxes && sourceTaxTotalNative > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
              <dt className="font-medium text-slate-800">{employmentLabel}</dt>
              <dd className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2">
                <span className="text-slate-600">Итого в стране</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(sourceTaxTotalNative, sourceCurrency)}
                </span>
              </dd>
            </div>
          )}

          {hasResidenceBlock && residenceTaxTotal > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
              <dt className="font-medium text-slate-800">{residenceCountry}</dt>
              <dd className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2">
                <span className="text-slate-600">Итого в стране</span>
                <LocalCurrencyWithBaseHint
                  amountInBase={residenceTaxTotal}
                  localCurrency={residenceLocalCurrency}
                  baseCurrency={baseCurrency}
                />
              </dd>
              {taxSummary.foreignTaxCredit > 0 && (
                <p className="mt-2 text-xs text-emerald-700">
                  С учётом зачёта НДФЛ РФ (−{formatCurrency(foreignTaxCreditLocal, residenceLocalCurrency)}
                  {residenceLocalCurrency !== baseCurrency &&
                    ` ≈ ${formatCurrency(taxSummary.foreignTaxCredit, baseCurrency)}`}
                  )
                </p>
              )}
            </div>
          )}

          {(sourceTaxTotalNative > 0 || residenceTaxTotal > 0) &&
            (sourceCurrency !== baseCurrency || residenceLocalCurrency !== baseCurrency) && (
              <div className="flex justify-between gap-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm">
                <dt className="text-slate-600">
                  Суммарно в {baseCurrency} (оценка по курсу)
                </dt>
                <dd className="font-semibold text-slate-800">
                  {formatCurrency(grandTotalInBase, baseCurrency)}
                </dd>
              </div>
            )}

          {(sourceTaxTotalNative > 0 || residenceTaxTotal > 0) &&
            sourceCurrency === baseCurrency &&
            residenceLocalCurrency === baseCurrency && (
              <div className="flex justify-between gap-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base">
                <dt className="font-medium text-slate-800">Всего по всем странам</dt>
                <dd className="font-bold text-slate-900">
                  {formatCurrency(sourceTaxTotalNative + residenceTaxTotal, baseCurrency)}
                </dd>
              </div>
            )}
        </dl>
        {showGrandTotalFooter && (
          <p className="mt-2 text-xs text-slate-500">
            Итог по каждой стране — в её валюте (налоги в {employmentLabel} — в {sourceCurrency},
            в {residenceCountry} — в {residenceLocalCurrency}
            {residenceLocalCurrency !== baseCurrency ? `, ≈ ${baseCurrency} по курсу` : ''}). Взносы
            работодателя в РФ не включены.
          </p>
        )}
      </section>
    </div>
  )
}

export function TaxesOverviewPanel({
  yearSummaries,
  settings,
  hasIncomes,
}: TaxesOverviewPanelProps) {
  const showSourceTaxes = shouldShowSourceCountryTaxes(settings)
  const multiYear = yearSummaries.length > 1
  const horizonTotalInBase = yearSummaries.reduce(
    (sum, yearSummary) => sum + yearTaxTotalInBase(yearSummary, settings, showSourceTaxes),
    0,
  )

  if (yearSummaries.length === 0) return null

  function renderYear(yearSummary: YearTaxSummary, yearLabel?: string) {
    const multiPart = yearSummary.parts.length > 1
    return (
      <div className="space-y-0">
        {yearLabel && !multiPart && (
          <h3 className="mb-4 text-base font-semibold text-slate-900">{yearLabel}</h3>
        )}
        {yearLabel && multiPart && (
          <h3 className="mb-4 text-base font-semibold text-slate-900">{yearLabel}</h3>
        )}
        {yearSummary.parts.map((part, partIndex) => {
          const partSettings: BudgetSettings = {
            ...settings,
            countryCode: part.countryCode,
            taxRegimeId: part.taxRegimeId,
          }
          return (
            <div key={`${part.countryCode}-${part.startDate}-${partIndex}`}>
              {partIndex > 0 && <SectionDivider />}
              <YearTaxBlock
                taxSummary={part.summary}
                settings={partSettings}
                hasIncomes={hasIncomes}
                showGrandTotalFooter={!multiYear && !multiPart}
                yearLabel={
                  multiPart
                    ? `${COUNTRY_LABELS[part.countryCode] ?? part.countryCode} (${part.startDate} – ${part.endDate})`
                    : undefined
                }
              />
            </div>
          )
        })}
      </div>
    )
  }

  if (!multiYear) {
    return renderYear(yearSummaries[0])
  }

  return (
    <div className="space-y-0">
      {yearSummaries.map((yearSummary, index) => (
        <div key={yearSummary.year}>
          {index > 0 && <SectionDivider />}
          {renderYear(yearSummary, `${yearSummary.year} год`)}
        </div>
      ))}

      <SectionDivider />
      <section>
        <SectionHeading>Общая сумма по всем годам</SectionHeading>
        <div className="flex justify-between gap-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base">
          <dt className="font-medium text-slate-800">
            Итого за {yearSummaries.length}{' '}
            {yearSummaries.length === 1
              ? 'год'
              : yearSummaries.length < 5
                ? 'года'
                : 'лет'}
          </dt>
          <dd className="font-bold text-slate-900">
            {formatCurrency(horizonTotalInBase, settings.baseCurrency)}
          </dd>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Сумма годовых налогов по календарным годам и странам маршрута (в{' '}
          {settings.baseCurrency}, оценка по курсу). Взносы работодателя в РФ не включены.
        </p>
      </section>
    </div>
  )
}
