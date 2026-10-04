import {redirect} from 'next/navigation';

export default async function ProtectedLandingPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  redirect(`/${locale}/app/chat`);
}
