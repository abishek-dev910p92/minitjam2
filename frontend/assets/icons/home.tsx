import React from 'react';
import Svg, { Path } from 'react-native-svg';

const HomeIcon = ({ color, ...props }: { color?: string; [key: string]: any }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M9.75 21.75h4.5c4.5 0 6.75-2.25 6.75-6.75V9c0-4.5-2.25-6.75-6.75-6.75h-4.5C5.25 2.25 3 4.5 3 9v6c0 4.5 2.25 6.75 6.75 6.75ZM12 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
      stroke={color || '#000'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default HomeIcon;