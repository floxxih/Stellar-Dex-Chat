import { NextRequest, NextResponse } from 'next/server';
import { getPayoutProvider } from '@/lib/payout/providers/registry';
import { telemetry } from '@/lib/telemetry';
import { applyRateLimit, getClientIp } from '@/lib/rateLimit';

const RATE_LIMIT = { maxRequests: 3, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = applyRateLimit(ip, '/api/initiate-transfer', RATE_LIMIT);
  if (limited) return limited;

  const traceContext = telemetry.extractTraceFromHeaders(request.headers);
  const span = telemetry.createSpan(
    'initiate-transfer',
    traceContext.spanId,
    traceContext.traceId,
  );

  try {
    telemetry.addLog(span.spanId, 'info', 'Starting transfer initiation', {
      endpoint: '/api/initiate-transfer',
    });

    const { source, reason, amount, recipient, reference } =
      await request.json();

    telemetry.addLog(span.spanId, 'info', 'Request parsed', {
      hasSource: !!source,
      hasAmount: !!amount,
      hasRecipient: !!recipient,
      amount: amount,
    });

    if (!source || !amount || !recipient) {
      telemetry.addLog(span.spanId, 'warn', 'Validation failed', {
        missingFields: {
          source: !source,
          amount: !amount,
          recipient: !recipient,
        },
      });
      telemetry.finishSpan(span.spanId, {
        success: false,
        error: 'Missing required fields',
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Source, amount, and recipient are required',
        },
        { status: 400 },
      );
    }

    const provider = getPayoutProvider();
    const data = await provider.initiateTransfer({
      source,
      reason,
      amount,
      recipient,
      reference,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    telemetry.addLog(
      span.spanId,
      'error',
      'Unhandled error in transfer initiation',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    );

    console.error('Initiate transfer error:', error);

    telemetry.finishSpan(span.spanId, {
      success: false,
      error: 'Failed to initiate transfer. Please try again.',
      errorType: 'unknown_error',
    });

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to initiate transfer. Please try again.',
      },
      { status: 500 },
    );
  }
}
