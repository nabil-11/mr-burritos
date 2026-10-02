import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Employee } from '@/lib/models/Employee'
import { requireAuth } from '@/lib/auth'
import { overview } from '@/lib/employeeAccount'
import { currentMonth } from '@/lib/payroll'
import { employeeError, employeeFields } from './fields'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees — les employés, chacun avec ce qui lui est dû
 * aujourd'hui (`balance`) et ses avances du mois. `?active=1` : seulement ceux
 * qu'on peut encore payer d'une avance — ce que la caisse et le formulaire de
 * dépense proposent, solde compris, pour qu'on voie avant de donner.
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth(req)
    const activeOnly = req.nextUrl.searchParams.get('active') === '1'
    const list = await overview(currentMonth(), { activeOnly })
    return NextResponse.json(
      list.map(({ employee: e, month, balance }) => ({
        _id: e._id,
        name: e.name,
        poste: e.poste,
        phone: e.phone,
        salary: e.salary,
        isActive: e.isActive,
        balance,
        monthAdvances: month.avances,
      }))
    )
  } catch (e: unknown) {
    return employeeError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const { salaryFrom, ...fields } = employeeFields(await req.json().catch(() => ({})), true)
    const trackFrom = fields.trackFrom ?? currentMonth()
    const salary = fields.salary ?? 0
    const employee = await Employee.create({
      ...fields,
      trackFrom,
      salary,
      salaries: [{ from: salaryFrom && salaryFrom > trackFrom ? salaryFrom : trackFrom, amount: salary }],
    })
    return NextResponse.json(employee, { status: 201 })
  } catch (e: unknown) {
    return employeeError(e)
  }
}
