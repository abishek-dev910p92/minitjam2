import React from 'react';
import Svg, { Path } from 'react-native-svg';

const MessageIcon = ({ color = '#000', ...props }: { color?: string } & React.SVGProps<SVGSVGElement>) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...(props as any)}>
    <Path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={color || '#000'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default MessageIcon;