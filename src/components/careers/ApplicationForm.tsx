'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InquiryForm } from '@/components/form/InquiryForm';
import { applicationForm, getPosition } from '@/config/careers';

/**
 * The application form, with the position pre-chosen.
 *
 * "Apply now" on a position card links to `/careers?role=<id>#apply`. Reading
 * it here rather than holding the selection in page state means the link is a
 * real, shareable URL - someone can send "apply for the setter role" to a
 * friend and the dropdown arrives already set.
 *
 * `useSearchParams` suspends during prerender, so the Suspense boundary below
 * is what keeps /careers a static page.
 */
function Inner() {
  const role = useSearchParams().get('role');
  // Only accept a value the dropdown actually offers - an unknown ?role= must
  // not put the select into a state the schema will reject.
  const position = role === 'future' ? 'future' : getPosition(role ?? '')?.id;

  return (
    <InquiryForm
      form={applicationForm}
      source={`careers:${position ?? 'unspecified'}`}
      initialValues={position ? { position } : undefined}
      // Remount when the role changes: react-hook-form reads defaultValues
      // once, so without this a second "Apply now" would not move the select.
      key={position ?? 'none'}
    />
  );
}

export function ApplicationForm() {
  return (
    <Suspense fallback={<div className="card min-h-[42rem] p-6 md:p-10" aria-hidden />}>
      <Inner />
    </Suspense>
  );
}
