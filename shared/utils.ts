/**
 * Calcula a comissão com base no valor de vendas e taxa de comissão
 * @param salesAmount - Valor total de vendas
 * @param commissionRate - Taxa de comissão (ex: 0.005 para 0.5%)
 * @returns Valor da comissão
 */
export function calculateCommission(salesAmount: number, commissionRate: number = 0.005): number {
  return salesAmount * commissionRate;
}

/**
 * Formata um valor monetário para exibição
 * @param value - Valor a ser formatado
 * @returns String formatada (ex: "R$ 1.234,56")
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma porcentagem para exibição
 * @param value - Valor decimal (ex: 0.005 para 0.5%)
 * @returns String formatada (ex: "0,5%")
 */
export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  }).format(value);
}
