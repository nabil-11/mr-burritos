import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Employee } from '@/lib/models/Employee'
import { requireAuth } from '@/lib/auth'
import { hasHistory, setupOf } from '@/lib/employeeAccount'
import { currentMonth } from '@/lib/payroll'
import { employeeError, employeeFields } from '../fields'

type Ctx = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

// No GET here on purpose: an employee's account (salary, balance, CIN) is
// private, and the back-office page reads it server-side. See ../route.ts.

/**
 * Un changement de salaire ne réécrit pas le passé : il entre dans le barème
 * à partir d'un mois (le mois en cours par défaut), et les mois d'avant
 * gardent le salaire qu'ils avaient.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    await connectDB()
    const { salaryFrom, salary, isActive, ...fields } = employeeFields(await req.json().catch(() => ({})), false)
    const employee = await Employee.findById(id)
    if (!employee) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    // Une fiche d'avant le barème : on fige d'abord ce qu'elle était.
    if (!employee.salaries?.length || !employee.trackFrom) {
      const setup = setupOf(employee.toObject())
      employee.trackFrom = setup.trackFrom
      employee.salaries = setup.salaries
    }
    employee.set(fields)

    if (salary !== undefined && salary !== employee.salary) {
      const from = salaryFrom ?? currentMonth()
      const scale = (employee.salaries as { from: string; amount: number }[])
        .map((s) => ({ from: s.from, amount: s.amount }))
        .filter((s) => s.from !== from)
      scale.push({ from, amount: salary })
      scale.sort((a, b) => a.from.localeCompare(b.from))
      employee.salaries = scale
      employee.salary = scale.at(-1)!.amount
    }

    if (isActive !== undefined && isActive !== employee.isActive) {
      employee.isActive = isActive
      // Son salaire cesse de courir après le mois où il part, et reprend s'il revient.
      employee.leftAt = isActive ? null : new Date()
    }

    await employee.save()
    return NextResponse.json(employee)
  } catch (e: unknown) {
    return employeeError(e)
  }
}

/**
 * Refusée dès qu'une ligne le concerne : avances et paiements restent sur les
 * recettes, et son compte est le seul endroit où ils se relisent ensemble. Le
 * désactiver le retire de la caisse sans rien perdre.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    if (await hasHistory(id)) {
      return NextResponse.json(
        { error: 'Cet employé a un historique (avances, paiements) : désactivez-le plutôt que de le supprimer' },
        { status: 409 }
      )
    }
    await connectDB()
    await Employee.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return employeeError(e)
  }
}
