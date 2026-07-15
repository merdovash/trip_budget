import { useMemo, useState, type ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import { getCountryLocalCurrency } from '../../config/foodBudget'
import {
  convertAmountFromBase,
  convertScheduledPaymentsFromBase,
  convertTaxResultFromBase,
} from '../../lib/taxCurrencyDisplay'
import type { FullTaxSummary, YearTaxPart, YearTaxSummary } from '../../engine/budgetEngine'
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
import { StackPanel } from '../ui/StackPanel'
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
  /** Показать только блок зачёта (для панели зачёта). */
  creditOnly?: boolean
  /** Скрыть блок у источника (для панели проживания). */
  hideSource?: boolean
  /** Показать только налоги у источника (для панели заработка). */
  sourceOnly?: boolean
}

interface TaxesOverviewPanelProps {
  yearSummaries: YearTaxSummary[]
  settings: BudgetSettings
  hasIncomes: boolean
}

type DetailTarget =
  | { kind: 'employment' }
  | { kind: 'residence'; countryCode: string }
  | { kind: 'credit'; countryCode: string }

interface ResidenceAggregate {
  countryCode: string
  /** Налог проживания до зачёта (в base). */
  taxGrossInBase: number
  /** Налог проживания после зачёта (в base). */
  taxNetInBase: number
  foreignTaxCreditInBase: number
  parts: YearTaxPart[]
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h3>
  )
}

function SectionDivider() {
  return <hr className="my-6 border-slate-100" />
}

function ClickableAmount({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-1 py-0.5 font-semibold tabular-nums text-blue-700 underline-offset-2 hover:bg-blue-50 hover:underline"
    >
      {children}
    </button>
  )
}

function YearTaxBlock({
  taxSummary,
  settings,
  hasIncomes,
  showGrandTotalFooter,
  yearLabel,
  creditOnly = false,
  hideSource = false,
  sourceOnly = false,
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
    showSourceTaxes && taxSummary.sourceSalary ? taxSummary.sourceSalary.ndfl : 0
  const grandTotalInBase =
    (showSourceTaxes ? taxSummary.sourceIncomeTaxInBase : 0) + residenceTaxTotal

  const residenceResultForDisplay =
    taxSummary.residence &&
    convertTaxResultFromBase(taxSummary.residence.result, baseCurrency, residenceLocalCurrency)
  const residencePaymentsForDisplay = taxSummary.residenceTaxSchedule?.payments
    ? convertScheduledPaymentsFromBase(
        taxSummary.residenceTaxSchedule.payments,
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

  const foreignDetail = taxSummary.foreignSalary

  const hasResidenceBlock = Boolean(taxSummary.residence)
  const hasAnyTaxBlock = hasResidenceBlock || (showSourceTaxes && taxSummary.sourceSalary) || hasIncomes

  if (!hasAnyTaxBlock) return null

  if (creditOnly) {
    return (
      <div className="space-y-4">
        {yearLabel && <h3 className="text-base font-semibold text-slate-900">{yearLabel}</h3>}
        <section>
          <SectionHeading>Налоговый зачёт ({residenceCountry})</SectionHeading>
          <dl className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Сумма зачёта</dt>
              <dd className="font-semibold text-emerald-800">
                {formatCurrency(foreignTaxCreditLocal, residenceLocalCurrency)}
                {residenceLocalCurrency !== baseCurrency && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ≈ {formatCurrency(taxSummary.foreignTaxCredit, baseCurrency)}
                  </span>
                )}
              </dd>
            </div>
            {foreignDetail?.sourceTaxInBase != null && (
              <div className="flex justify-between gap-4 border-t border-emerald-100 pt-2">
                <dt className="text-slate-600">НДФЛ РФ (база зачёта)</dt>
                <dd className="font-medium text-slate-800">
                  {formatCurrency(foreignDetail.sourceTaxInBase, baseCurrency)}
                </dd>
              </div>
            )}
            {foreignDetail?.irpfGross != null && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">IRPF на долю зарплаты РФ</dt>
                  <dd>
                    {formatCurrency(
                      convertAmountFromBase(
                        foreignDetail.irpfOnForeignSalary ?? 0,
                        baseCurrency,
                        residenceLocalCurrency,
                      ),
                      residenceLocalCurrency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">IRPF до зачёта</dt>
                  <dd>
                    {formatCurrency(
                      convertAmountFromBase(
                        foreignDetail.irpfGross,
                        baseCurrency,
                        residenceLocalCurrency,
                      ),
                      residenceLocalCurrency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">IRPF после зачёта</dt>
                  <dd className="font-semibold">
                    {formatCurrency(
                      convertAmountFromBase(
                        foreignDetail.irpfNetAfterCredit ?? 0,
                        baseCurrency,
                        residenceLocalCurrency,
                      ),
                      residenceLocalCurrency,
                    )}
                  </dd>
                </div>
              </>
            )}
            {foreignDetail?.pitGross != null && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">PIT на иностранную зарплату</dt>
                  <dd>
                    {formatCurrency(
                      convertAmountFromBase(
                        foreignDetail.pitOnForeignSalary ?? 0,
                        baseCurrency,
                        residenceLocalCurrency,
                      ),
                      residenceLocalCurrency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Оценка remittance</dt>
                  <dd>
                    {formatCurrency(
                      convertAmountFromBase(
                        foreignDetail.remittanceEstimate ?? 0,
                        baseCurrency,
                        residenceLocalCurrency,
                      ),
                      residenceLocalCurrency,
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <p className="mt-3 text-sm text-slate-600">
            Основание: зачёт налога, уплаченного у источника в России, против налога страны
            проживания (договор об избежании двойного налогообложения / национальные правила, упрощ.).
          </p>
        </section>
        {hasIncomes && (
          <section>
            <SectionHeading>Основания и доходы</SectionHeading>
            <DoubleTaxationPanel
              lines={taxSummary.doubleTaxation}
              countryCode={settings.countryCode}
              embedded
            />
          </section>
        )}
        {residenceResultForDisplay && (
          <section>
            <SectionHeading>Вычеты и строки расчёта</SectionHeading>
            <TaxBreakdown
              regimeName={taxSummary.residence!.calculator.name}
              effectiveRate={taxSummary.residence!.result.effectiveRate}
              breakdown={residenceResultForDisplay.breakdown}
              currency={residenceLocalCurrency}
              embedded
            />
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {yearLabel && (
        <h3 className="mb-4 text-base font-semibold text-slate-900">{yearLabel}</h3>
      )}

      {!hideSource && (
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
          ) : showSourceTaxes && taxSummary.sourceSalary ? (
            <TaxBreakdown
              regimeName="НДФЛ (зарплата в России)"
              effectiveRate={
                taxSummary.sourceSalary.grossAnnual > 0
                  ? taxSummary.sourceSalary.ndfl / taxSummary.sourceSalary.grossAnnual
                  : 0
              }
              breakdown={taxSummary.sourceSalary.breakdown}
              currency="RUB"
              footer={
                taxSummary.sourceEmployerSocialInBase > 0
                  ? `Взносы работодателя ≈ ${formatCurrency(taxSummary.sourceEmployerSocialInBase, settings.baseCurrency)} (информ.)`
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
      )}

      {sourceOnly ? null : hasResidenceBlock && (
        <>
          {!hideSource && <SectionDivider />}
          <section>
            <SectionHeading>Налоги в стране проживания ({residenceCountry})</SectionHeading>
            {taxSummary.residence?.calculator.countryCode === 'ES' ? (
              <SpainTaxDetailPanel
                regimeName={taxSummary.residence.calculator.name}
                regimeDescription={taxSummary.residence.calculator.description}
                taxRegimeId={taxSummary.residence.calculator.id}
                result={residenceResultForDisplay!}
                currency={residenceLocalCurrency}
                paymentSchedule={residencePaymentsForDisplay}
                quarterlyGross={taxSummary.residenceTaxSchedule?.quarterlyGross}
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

      {hasIncomes && !creditOnly && !sourceOnly && (
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

      {showGrandTotalFooter && (
        <>
          <SectionDivider />
          <section>
            <SectionHeading>Итого налогов за год</SectionHeading>
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
                      С учётом зачёта НДФЛ РФ (−
                      {formatCurrency(foreignTaxCreditLocal, residenceLocalCurrency)}
                      {residenceLocalCurrency !== baseCurrency &&
                        ` ≈ ${formatCurrency(taxSummary.foreignTaxCredit, baseCurrency)}`}
                      )
                    </p>
                  )}
                </div>
              )}

              {(sourceTaxTotalNative > 0 || residenceTaxTotal > 0) && (
                <div className="flex justify-between gap-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base">
                  <dt className="font-medium text-slate-800">Всего по всем странам</dt>
                  <dd className="font-bold text-slate-900">
                    {formatCurrency(grandTotalInBase, baseCurrency)}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </>
      )}
    </div>
  )
}

function aggregateTaxTotals(
  yearSummaries: YearTaxSummary[],
  settings: BudgetSettings,
  showSourceTaxes: boolean,
) {
  let employmentInBase = 0
  let employmentNative = 0
  const employmentParts: YearTaxPart[] = []
  const residenceMap = new Map<string, ResidenceAggregate>()

  for (const yearSummary of yearSummaries) {
    yearSummary.parts.forEach((part, index) => {
      if (index === 0 && showSourceTaxes) {
        employmentInBase += part.summary.sourceIncomeTaxInBase
        employmentNative += part.summary.sourceSalary?.ndfl ?? 0
        if (part.summary.sourceSalary || part.summary.sourceIncomeTaxInBase > 0) {
          employmentParts.push(part)
        }
      }
      const net =
        (part.summary.residence?.result.incomeTax ?? 0) +
        (part.summary.residence?.result.socialContributions ?? 0)
      const credit = part.summary.foreignTaxCredit ?? 0
      const existing = residenceMap.get(part.countryCode)
      if (existing) {
        existing.taxNetInBase += net
        existing.taxGrossInBase += net + credit
        existing.foreignTaxCreditInBase += credit
        existing.parts.push(part)
      } else {
        residenceMap.set(part.countryCode, {
          countryCode: part.countryCode,
          taxNetInBase: net,
          taxGrossInBase: net + credit,
          foreignTaxCreditInBase: credit,
          parts: [part],
        })
      }
    })
  }

  const residences = [...residenceMap.values()]
  const totalInBase =
    employmentInBase + residences.reduce((sum, row) => sum + row.taxNetInBase, 0)

  return {
    employmentInBase,
    employmentNative,
    employmentParts,
    residences,
    totalInBase,
    expectedTotal: yearSummaries.reduce(
      (sum, y) => sum + yearTaxTotalInBase(y, settings, showSourceTaxes),
      0,
    ),
  }
}

export function TaxesOverviewPanel({
  yearSummaries,
  settings,
  hasIncomes,
}: TaxesOverviewPanelProps) {
  const showSourceTaxes = shouldShowSourceCountryTaxes(settings)
  const multiYear = yearSummaries.length > 1
  const employmentLabel = getEmploymentCountryLabel(settings)
  const sourceCurrency = getEmploymentCountryCurrency(settings)
  const baseCurrency = settings.baseCurrency
  const [detail, setDetail] = useState<DetailTarget | null>(null)

  const totals = useMemo(
    () => aggregateTaxTotals(yearSummaries, settings, showSourceTaxes),
    [yearSummaries, settings, showSourceTaxes],
  )

  if (yearSummaries.length === 0) return null

  const detailTitle =
    detail?.kind === 'employment'
      ? `Налоги в стране заработка (${employmentLabel})`
      : detail?.kind === 'residence'
        ? `Налоги в стране проживания (${COUNTRY_LABELS[detail.countryCode] ?? detail.countryCode})`
        : detail?.kind === 'credit'
          ? `Налоговый зачёт (${COUNTRY_LABELS[detail.countryCode] ?? detail.countryCode})`
          : ''

  function renderYear(yearSummary: YearTaxSummary, yearLabel?: string) {
    const multiPart = yearSummary.parts.length > 1
    return (
      <div className="space-y-0">
        {yearLabel && (
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
                showGrandTotalFooter={false}
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

  return (
    <div className="space-y-0">
      <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
        <SectionHeading>Итого налогов</SectionHeading>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-600">
            За {multiYear ? `${yearSummaries.length} г. горизонта` : 'год'} · клик по сумме открывает
            расчёт
          </p>
          <p className="text-xl font-bold text-slate-900">
            {formatCurrency(totals.totalInBase, baseCurrency)}
          </p>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {showSourceTaxes && totals.employmentInBase > 0 && (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
              <span className="text-slate-700">
                <span className="mr-1 font-medium text-slate-400">+</span>
                Налоги в стране заработка ({employmentLabel})
              </span>
              <ClickableAmount onClick={() => setDetail({ kind: 'employment' })}>
                {formatCurrency(totals.employmentNative, sourceCurrency)}
                {sourceCurrency !== baseCurrency && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ≈ {formatCurrency(totals.employmentInBase, baseCurrency)}
                  </span>
                )}
              </ClickableAmount>
            </li>
          )}

          {totals.residences.map((row) => {
            const label = COUNTRY_LABELS[row.countryCode] ?? row.countryCode
            return (
              <li key={row.countryCode} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                  <span className="text-slate-700">
                    <span className="mr-1 font-medium text-slate-400">+</span>
                    Налоги в стране проживания ({label})
                  </span>
                  <ClickableAmount
                    onClick={() => setDetail({ kind: 'residence', countryCode: row.countryCode })}
                  >
                    {formatCurrency(row.taxGrossInBase, baseCurrency)}
                  </ClickableAmount>
                </div>
                {row.foreignTaxCreditInBase > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50/80 px-3 py-2">
                    <span className="text-emerald-800">
                      <span className="mr-1 font-medium text-emerald-600">−</span>
                      Налоговый зачёт ({label})
                    </span>
                    <ClickableAmount
                      onClick={() => setDetail({ kind: 'credit', countryCode: row.countryCode })}
                    >
                      −{formatCurrency(row.foreignTaxCreditInBase, baseCurrency)}
                    </ClickableAmount>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <p className="mt-3 text-xs text-slate-500">
          Итого = налоги у источника
          {totals.residences.map((row) => {
            const name = COUNTRY_LABELS[row.countryCode] ?? row.countryCode
            return ` + проживание (${name})${row.foreignTaxCreditInBase > 0 ? ` − зачёт (${name})` : ''}`
          }).join('')}
          . Суммы в {baseCurrency} (оценка по курсу).
        </p>
      </section>

      {multiYear ? (
        <>
          {yearSummaries.map((yearSummary, index) => (
            <div key={yearSummary.year}>
              {index > 0 && <SectionDivider />}
              {renderYear(yearSummary, `${yearSummary.year} год`)}
            </div>
          ))}
        </>
      ) : (
        renderYear(yearSummaries[0])
      )}

      <StackPanel
        open={detail != null}
        title={detailTitle}
        onClose={() => setDetail(null)}
      >
        {detail?.kind === 'employment' &&
          totals.employmentParts.map((part, index) => (
            <div key={`emp-${index}`} className={index > 0 ? 'mt-6 border-t border-slate-100 pt-6' : ''}>
              <YearTaxBlock
                taxSummary={part.summary}
                settings={settings}
                hasIncomes={hasIncomes}
                showGrandTotalFooter={false}
                yearLabel={multiYear ? `Период: ${part.startDate} – ${part.endDate}` : undefined}
                sourceOnly
              />
            </div>
          ))}

        {detail?.kind === 'residence' &&
          (totals.residences.find((r) => r.countryCode === detail.countryCode)?.parts ?? []).map(
            (part, index) => (
              <div
                key={`res-${part.countryCode}-${index}`}
                className={index > 0 ? 'mt-6 border-t border-slate-100 pt-6' : ''}
              >
                <YearTaxBlock
                  taxSummary={part.summary}
                  settings={{
                    ...settings,
                    countryCode: part.countryCode,
                    taxRegimeId: part.taxRegimeId,
                  }}
                  hasIncomes={hasIncomes}
                  showGrandTotalFooter={false}
                  yearLabel={
                    multiYear || totals.residences.find((r) => r.countryCode === detail.countryCode)!.parts.length > 1
                      ? `${part.startDate} – ${part.endDate}`
                      : undefined
                  }
                  hideSource
                />
              </div>
            ),
          )}

        {detail?.kind === 'credit' &&
          (totals.residences.find((r) => r.countryCode === detail.countryCode)?.parts ?? []).map(
            (part, index) => (
              <div
                key={`cred-${part.countryCode}-${index}`}
                className={index > 0 ? 'mt-6 border-t border-slate-100 pt-6' : ''}
              >
                <YearTaxBlock
                  taxSummary={part.summary}
                  settings={{
                    ...settings,
                    countryCode: part.countryCode,
                    taxRegimeId: part.taxRegimeId,
                  }}
                  hasIncomes={hasIncomes}
                  showGrandTotalFooter={false}
                  yearLabel={
                    multiYear ||
                    (totals.residences.find((r) => r.countryCode === detail.countryCode)?.parts
                      .length ?? 0) > 1
                      ? `${part.startDate} – ${part.endDate}`
                      : undefined
                  }
                  creditOnly
                />
              </div>
            ),
          )}
      </StackPanel>
    </div>
  )
}
