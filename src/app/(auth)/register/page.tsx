import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import AuthForm from '../AuthForm';

export default async function RegisterPage() {
  if ((await auth())?.user) redirect('/dashboard');
  return <AuthForm mode="register" />;
}
