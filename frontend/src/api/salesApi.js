import { authApi as api } from './authApi'

const pad = (value) => String(value).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const salesParams = (companyId, start, end, brandId) => ({
  companyId,
  startDate: fmt(start),
  endDate: fmt(end),
  ...(brandId ? { brandId } : {})
})

export const getSummary = (companyId, start, end, brandId) =>
  api.get('/sales/summary', { params: salesParams(companyId, start, end, brandId) })

export const getProductSales = (companyId, start, end, brandId) =>
  api.get('/sales/product', { params: salesParams(companyId, start, end, brandId) })

export const getBrandSales = (companyId, start, end, brandId) =>
  api.get('/sales/brand', { params: salesParams(companyId, start, end, brandId) })

export const getShopSales = (companyId, start, end, brandId) =>
  api.get('/sales/shop', { params: salesParams(companyId, start, end, brandId) })

export const getShopBrandSales = (companyId, start, end, brandId) =>
  api.get('/sales/shop-brand', { params: salesParams(companyId, start, end, brandId) })

export const getTrend = (companyId, start, end, granularity = 'DAY', brandId) =>
  api.get('/sales/trend', { params: { ...salesParams(companyId, start, end, brandId), granularity } })

export const getBrands = (companyId) =>
  api.get('/sales/brands', { params: { companyId } })

export const getProductInventory = (companyId, brandId, targetMonth) =>
  api.get('/products/inventory', {
    params: {
      companyId,
      ...(brandId ? { brandId } : {}),
      ...(targetMonth ? { targetMonth } : {})
    }
  })
