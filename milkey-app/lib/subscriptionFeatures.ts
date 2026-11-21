// Stored identifiers are kept for old subscriptions; labels reflect the app.
export type SubscriptionFeature = 'purchase' | 'selling' | 'register' | 'inventory' | 'user_login';
const FEATURE_LABELS: Record<string, string> = {
    purchase: 'Collection',
    selling: 'Selling',
    register: 'Register (legacy)',
    inventory: 'Inventory',
    user_login: 'User Login',
};
export const subscriptionFeatureLabel = (feature: string): string => FEATURE_LABELS[feature] || feature;
export const subscriptionFeatureDescription = (feature: string): string =>
    feature === 'inventory' ? 'Inventory access (coming soon)' : `${subscriptionFeatureLabel(feature)} access unlocked`;
