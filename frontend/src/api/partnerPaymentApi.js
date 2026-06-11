import { authApi as api } from './authApi'

const BASE = '/api/partner-payment-ledger'
const companyId = 1

export const getPaymentLedgerSummary = () =>
  api.get(`${BASE}/summary`, { params: { companyId } })

  export const getPaymentLedgerList = (direction) =>
    api.get(BASE, { params: { companyId, ...(direction ? { direction } : {}) } })

    export const createPaymentLedger = (payload) =>
      api.post(BASE, { company_id: companyId, ...payload })

      export const updatePaymentLedger = (id, payload) =>
        api.put(`${BASE}/${id}`, payload)

        export const deletePaymentLedger = (id) =>
          api.delete(`${BASE}/${id}`)

          export const toggleTaxInvoice = (id) =>
            api.patch(`${BASE}/${id}/toggle-tax-invoice`)

            export const togglePaymentConfirmed = (id) =>
              api.patch(`${BASE}/${id}/toggle-payment-confirmed`)
