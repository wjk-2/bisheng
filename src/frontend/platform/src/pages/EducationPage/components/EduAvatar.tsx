import React from 'react';

interface EduAvatarProps {
  id: string;
  type: 'path_general' | 'path_professional' | 'path_project' | 'course';
  url?: string | null;
  size?: 'md' | 'lg';
}

const GRADIENTS = [
  'linear-gradient(135deg, #4658FF 0%, #6B7FFF 100%)',
  'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)',
  'linear-gradient(135deg, #10B981 0%, #6EE7B7 100%)',
  'linear-gradient(135deg, #EF4444 0%, #FCA5A5 100%)',
];

function hashIndex(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % GRADIENTS.length;
}

const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 7h6M9 11h4"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const CircuitIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="white" strokeWidth="2" />
    <path
      d="M9 12H4M20 12h-5M12 9V4M12 20v-5M6 6l3 3M15 15l3 3M15 9l3-3M6 18l3-3"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const RocketIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C12 2 7 6 7 13l2 2c0 0 1-3 3-3s3 3 3 3l2-2c0-7-5-11-5-11z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 15l-2 4 3-1M15 15l2 4-3-1"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="11" r="1.5" fill="white" />
  </svg>
);

const PencilIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 5l4 4"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function getIcon(type: 'path_general' | 'path_professional' | 'path_project' | 'course'): React.ReactNode {
  switch (type) {
    case 'path_general':
      return <BookIcon />;
    case 'path_professional':
      return <CircuitIcon />;
    case 'path_project':
      return <RocketIcon />;
    case 'course':
      return <PencilIcon />;
    default:
      return <BookIcon />;
  }
}

const EduAvatar: React.FC<EduAvatarProps> = ({ id, type, url, size = 'md' }) => {
  const dimension = size === 'lg' ? 48 : 40;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={dimension}
        height={dimension}
        style={{
          width: dimension,
          height: dimension,
          objectFit: 'cover',
          borderRadius: 8,
          flexShrink: 0,
        }}
      />
    );
  }

  const gradient = GRADIENTS[hashIndex(id)];

  return (
    <div
      style={{
        width: dimension,
        height: dimension,
        background: gradient,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {getIcon(type)}
    </div>
  );
};

export default EduAvatar;
