import { NewClientForm } from '@/components/NewClientForm';
import { getDictionary } from '@/lib/i18n/server';

export default function NewClientPage() {
  const dict = getDictionary();
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-brand mb-6">{dict.clients.new.title}</h2>
      <NewClientForm />
    </div>
  );
}
