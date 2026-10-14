import React from "react";

interface CompanyLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export const GoogleLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export const MetaLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M16.92 4C14.77 4 13.06 5.16 12 6.64 10.94 5.16 9.23 4 7.08 4 3.17 4 0 7.27 0 11.3c0 4.03 3.17 7.3 7.08 7.3 2.15 0 3.86-1.16 4.92-2.64 1.06 1.48 2.77 2.64 4.92 2.64 3.91 0 7.08-3.27 7.08-7.3 0-4.03-3.17-7.3-7.08-7.3zm0 11.75c-2.34 0-4.25-1.99-4.25-4.45s1.91-4.45 4.25-4.45c2.34 0 4.25 1.99 4.25 4.45s-1.91 4.45-4.25 4.45zM7.08 15.75c-2.34 0-4.25-1.99-4.25-4.45s1.91-4.45 4.25-4.45c2.34 0 4.25 1.99 4.25 4.45s-1.91 4.45-4.25 4.45z" fill="#0081FB" />
  </svg>
);

export const AmazonLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M13.92 11.23c-1.39-.1-2.77.2-4.02.83-.8.4-1.28 1.15-1.28 2.05 0 1.34 1.05 2.37 2.38 2.37 1.25 0 2.31-.77 2.76-1.93.14-.36.19-.75.16-1.14v-2.18zm2.42 6.07c-.36.31-.85.35-1.26.11-.74-.43-1.11-1.02-1.32-1.85-.94 1.3-2.45 2.08-4.09 2.08-2.6 0-4.67-1.9-4.67-4.55 0-2.07 1.28-3.79 3.23-4.44 1.49-.49 3.39-.63 4.99-.44v-.44c0-1.06-.72-1.9-2.02-1.9-1.28 0-2.3.57-2.64 1.76-.09.3-.35.5-.66.5H7.78c-.37 0-.69-.28-.73-.65.45-2.22 2.45-3.66 5.56-3.66 3.06 0 4.88 1.71 4.88 4.7v5.19c0 1.02.43 1.48 1.09 1.48.24 0 .47-.06.67-.18.25-.15.57-.08.73.17l.86 1.31c.14.21.11.49-.07.67-.84.8-1.94 1.23-3.07 1.23-.71 0-1.34-.23-1.86-.68z" fill="currentColor" />
    <path d="M21.72 19.34c-2.9 2.14-6.86 3.27-10.74 3.27-5.06 0-9.82-1.89-13.35-5.26-.28-.27-.26-.71.04-.95.3-.24.74-.21 1 .07 3.26 3.1 7.64 4.84 12.31 4.84 3.56 0 7.2-1.04 9.87-3.01.37-.28.89-.19 1.16.18.28.37.19.89-.29 1.16z" fill="#FF9900" />
    <path d="M22.84 17.65c-.35-.45-2.3-.21-3.44.25-.35.14-.39-.25-.07-.47 2.07-1.42 4.14-.38 4.3.58.15.93-1.45 3.01-3.48 4.5-.31.23-.61.1-.47-.2.46-.99 1.95-3.8 3.16-4.66z" fill="#FF9900" />
  </svg>
);

export const AppleLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.8 1.44-.59.69-1.11 1.76-1.03 2.82 1.07.08 2.16-.54 2.82-1.39z" fill="currentColor" />
  </svg>
);

export const NetflixLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M5.398 0v24c1.848-.306 3.702-.638 5.564-.997V0H5.398zm7.64 0v22.565c1.862-.358 3.716-.69 5.564-.997V0h-5.564z" fill="#E50914" />
    <path d="M5.398 0l13.204 22.036V0h-2.167L5.398 18.423V0z" fill="#B81D24" />
  </svg>
);

export const OpenAILogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M22.28 9.5a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 10.6.43a6.05 6.05 0 0 0-5.77 4.2 6.05 6.05 0 0 0-4.08 2.96 6.07 6.07 0 0 0 .74 7.1 5.98 5.98 0 0 0 .52 4.9 6.05 6.05 0 0 0 6.51 2.9A6.05 6.05 0 0 0 13.4 23.57a6.05 6.05 0 0 0 5.77-4.2 6.05 6.05 0 0 0 4.08-2.96 6.07 6.07 0 0 0-.97-6.91zM13.4 21.94a4.42 4.42 0 0 1-2.9-.62 4.4 4.4 0 0 1-.22-.16l3.7-2.14a.82.82 0 0 0 .42-.71v-5.22l1.63.94v4.46a4.44 4.44 0 0 1-2.63 2.75zm-7.9-3.23a4.44 4.44 0 0 1-.77-2.86 4.37 4.37 0 0 1 .45-1.95l3.7 2.14a.83.83 0 0 0 .82 0l4.52-2.61v1.88l-3.86 2.23a4.44 4.44 0 0 1-4.86 1.17zM3.8 11.23a4.44 4.44 0 0 1 2.13-2.14v4.28a.83.83 0 0 0 .41.72l4.52 2.61-1.63.94-3.86-2.23a4.44 4.44 0 0 1-1.57-4.18zm14.3-1.78l-4.52-2.61 1.63-.94 3.86 2.23a4.44 4.44 0 0 1 1.57 4.18 4.44 4.44 0 0 1-2.13 2.14v-4.28a.83.83 0 0 0-.41-.72zm2.1 6.52a4.44 4.44 0 0 1-.45 1.95l-3.7-2.14a.83.83 0 0 0-.82 0l-4.52 2.61v-1.88l3.86-2.23a4.44 4.44 0 0 1 4.86-1.17c.3.16.57.38.77.86zm-8.2-2.4l-2.02-1.17 2.02-1.17 2.02 1.17-2.02 1.17zM10.6 2.06a4.42 4.42 0 0 1 2.9.62c.08.05.15.1.22.16l-3.7 2.14a.82.82 0 0 0-.42.71v5.22l-1.63-.94V5.51A4.44 4.44 0 0 1 10.6 2.06z" fill="currentColor" />
  </svg>
);

export const MicrosoftLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M1 1h10v10H1z" fill="#F25022" />
    <path d="M13 1h10v10H13z" fill="#7FBA00" />
    <path d="M1 13h10v10H1z" fill="#00A4EF" />
    <path d="M13 13h10v10H13z" fill="#FFB900" />
  </svg>
);

export const UberLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v7.5a2.5 2.5 0 0 1-5 0V7h2v7.5a.5.5 0 0 0 1 0V7z" fill="currentColor" />
  </svg>
);

export const StripeLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697.5 12.754.5 6.947.5 3.018 3.543 3.018 8.44c0 4.887 3.843 6.425 7.42 7.72 2.378.857 3.197 1.547 3.197 2.483 0 .979-.861 1.487-2.28 1.487-2.457 0-5.344-1.127-7.23-2.259l-.916 5.613C5.16 24.512 8.243 25.5 11.402 25.5c6.038 0 10.04-2.925 10.04-8.066 0-5.006-3.905-6.529-7.466-7.884z" fill="#635BFF" />
  </svg>
);

export const DatabricksLogo: React.FC<CompanyLogoProps> = ({ className = "w-4 h-4", size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M1.08 7.23L12 1.15l10.92 6.08L12 13.31 1.08 7.23zm0 4.77L12 18.08l10.92-6.08v3.46L12 21.54 1.08 15.46V12zm0 4.77L12 22.85l10.92-6.08v2.08L12 24.92 1.08 18.85v-2.08z" fill="#FF3621" />
  </svg>
);

export function getCompanyLogo(slug: string, className = "w-4 h-4"): React.ReactNode {
  switch (slug.toLowerCase()) {
    case "google":
      return <GoogleLogo className={className} />;
    case "meta":
      return <MetaLogo className={className} />;
    case "amazon":
      return <AmazonLogo className={className} />;
    case "apple":
      return <AppleLogo className={className} />;
    case "netflix":
      return <NetflixLogo className={className} />;
    case "openai":
      return <OpenAILogo className={className} />;
    case "microsoft":
      return <MicrosoftLogo className={className} />;
    case "uber":
      return <UberLogo className={className} />;
    case "stripe":
      return <StripeLogo className={className} />;
    case "databricks":
      return <DatabricksLogo className={className} />;
    default:
      return null;
  }
}

export function CompanyBadge({ slug, name, className = "" }: { slug: string; name?: string; className?: string }) {
  const logo = getCompanyLogo(slug, "w-3.5 h-3.5 flex-shrink-0");
  const displayName = name || slug.charAt(0).toUpperCase() + slug.slice(1);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-muted/60 border border-border text-foreground hover:bg-muted transition-colors ${className}`}>
      {logo}
      <span>{displayName}</span>
    </span>
  );
}
