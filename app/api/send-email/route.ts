import { NextRequest, NextResponse } from 'next/server';
import { admin, deliver } from '../../../lib/server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers
      .get('authorization')
      ?.replace(/^Bearer /, '');

    if (!token) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 401 }
      );
    }

    const s = admin();
    const { data: { user }, error } = await s.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 401 }
      );
    }

    const { customerId, message } = await req.json();

    if (
      !Number.isInteger(customerId) ||
      typeof message !== 'string' ||
      !message.trim() ||
      message.length > 10000
    ) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { data: customer, error: dbError } = await s
      .from('customers')
      .select('email, expiration_date')
      .eq('id', customerId)
      .single();

    if (dbError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const rawDate = customer.expiration_date;

    if (
      typeof rawDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ) {
      return NextResponse.json(
        { error: 'Please save a valid expiration date for this customer.' },
        { status: 400 }
      );
    }

    const date = new Date(`${rawDate}T00:00:00Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== rawDate
    ) {
      return NextResponse.json(
        { error: 'Please save a valid expiration date for this customer.' },
        { status: 400 }
      );
    }

    const expirationDate = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const emailMessage =
      `${message.trim()}\n\n` +
      `Your 914 IPTV subscription expiration date is ${expirationDate}.\n\n` +
      `Thank you,\n914 IPTV`;

    await deliver(
      customer.email,
      'Message from 914 IPTV',
      emailMessage
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: 'Unable to send email. Check email service configuration.' },
      { status: 500 }
    );
  }
}
