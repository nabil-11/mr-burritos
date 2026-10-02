import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Employee } from '@/lib/models/Employee'
import { requireAuth } from '@/lib/auth'
import { overview } from '@/lib/employeeAccount'
import { currentMonth } from '@/lib/payroll'
import { employeeError, employeeFields } from './fields'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees — qui peut recevoir une dépense : nom et poste.
 * `?active=1` : seulement ceux qu'on peut encore payer.
 *
 * Ce que chacun touche et ce qui lui reste dû ne s'affiche pas sur la caisse,
 * devant le comptoir : par défaut cette liste n'en dit rien. Le formulaire de
 * dépense du back-office demande `?balance=1` pour montrer le reste à payer.
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth(req)
    const activeOnly = req.nextUrl.searchParams.get('active') === '1'
    if (req.nextUrl.searchParams.get('balance') === '1') {
      const list = await overview(currentMonth(), { activeOnly })
      return NextResponse.json(
        list.map(({ employee: e, balance }) => ({ _id: e._id, name: e.name, poste: e.poste, isActive: e.isActive, balance }))
      )
    }
    await connectDB()
    const list = (await Employee.find(activeOnly ? { isActive: true } : {})
      .sort({ name: 1 })
      .select('name poste isActive')
      .lean()) as { _id: unknown; name: string; poste?: string; isActive?: boolean }[]
    return NextResponse.json(
      list.map((e) => ({ _id: String(e._id), name: e.name, poste: e.poste ?? '', isActive: e.isActive !== false }))
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
