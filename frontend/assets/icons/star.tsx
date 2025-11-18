import React from 'react';
import Svg, { Path } from 'react-native-svg';

const StarIcon = ({ color = '#000', ...props }: { color?: string } & React.SVGProps<SVGSVGElement>) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...(props as any)}>
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke={color || '#000'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default StarIcon;