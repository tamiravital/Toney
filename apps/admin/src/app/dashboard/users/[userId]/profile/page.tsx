import { getUserProfile } from '@/lib/queries/users';
import { tensionLabel, toneLabel, depthLabel, learningStyleLabel, formatDate } from '@/lib/format';
import { tensionColor } from '@toney/constants';
import Badge from '@/components/Badge';
import { notFound } from 'next/navigation';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await getUserProfile(userId);

  if (!profile) {
    notFound();
  }

  const tColors = tensionColor(profile.tension_type);
  const secColors = tensionColor(profile.secondary_tension_type);

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Tension */}
      <Section title="Money Tension">
        <div className="space-y-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1">Primary Tension</dt>
            <dd className="flex items-center gap-2">
              {profile.tension_type ? (
                <Badge
                  label={tensionLabel(profile.tension_type)}
                  bg={tColors.light}
                  text={tColors.text}
                  size="md"
                />
              ) : (
                <span className="text-sm text-gray-400">Not identified</span>
              )}
              {profile.tension_score != null && (
                <span className="text-xs text-gray-500">Score: {profile.tension_score}</span>
              )}
            </dd>
          </div>
          {profile.secondary_tension_type && (
            <div>
              <dt className="text-xs font-medium text-gray-500 mb-1">Secondary Tension</dt>
              <dd>
                <Badge
                  label={tensionLabel(profile.secondary_tension_type)}
                  bg={secColors.light}
                  text={secColors.text}
                  size="md"
                />
              </dd>
            </div>
          )}
        </div>
      </Section>

      {/* Coaching Style */}
      <Section title="Coaching Style">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tone" value={toneLabel(profile.tone)} />
          <Field label="Depth" value={depthLabel(profile.depth)} />
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1">Learning Styles</dt>
            <dd className="flex flex-wrap gap-1">
              {profile.learning_styles.length > 0 ? (
                profile.learning_styles.map((s) => (
                  <Badge key={s} label={learningStyleLabel(s)} />
                ))
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </dd>
          </div>
        </div>
      </Section>

      {/* Life Context */}
      <Section title="Life Context">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Life Stage" value={profile.life_stage} />
          <Field label="Income Type" value={profile.income_type} />
          <Field label="Relationship Status" value={profile.relationship_status} />
        </div>
      </Section>

      {/* Emotional Why */}
      <Section title="Emotional Why">
        <p className="text-sm text-gray-700 leading-relaxed">
          {profile.emotional_why || <span className="text-gray-400">Not provided</span>}
        </p>
      </Section>

      {/* Onboarding Answers */}
      {profile.onboarding_answers && Object.keys(profile.onboarding_answers).length > 0 && (
        <div className="col-span-2">
          <Section title="Onboarding Answers">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(profile.onboarding_answers).map(([key, value]) => (
                <Field
                  key={key}
                  label={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  value={value}
                />
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Meta */}
      <div className="col-span-2">
        <Section title="Account Info">
          <div className="grid grid-cols-4 gap-4">
            <Field label="User ID" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{profile.id}</code>} />
            <Field label="Onboarding" value={profile.onboarding_completed ? 'Completed' : 'Incomplete'} />
            <Field label="Created" value={formatDate(profile.created_at)} />
            <Field label="Updated" value={formatDate(profile.updated_at)} />
          </div>
        </Section>
      </div>
    </div>
  );
}
