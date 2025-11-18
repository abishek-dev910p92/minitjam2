import React from 'react';
import Svg, { Path } from 'react-native-svg';

const MagnifierIcon = ({ color, ...props }: { color?: string } & React.SVGProps<SVGSVGElement>) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...(props as any)}>
    <Path
      d="M11.5 21.75a9.75 9.75 0 1 0 0-19.5 9.75 9.75 0 0 0 0 19.5ZM19.5 19.5l-3.263-3.263"
      stroke={color || '#000'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default MagnifierIcon;