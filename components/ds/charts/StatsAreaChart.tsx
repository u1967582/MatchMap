import * as React from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle } from 'react-native-svg';
import AppText from '../primitives/AppText';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { computeChartDomain, scalePoints, buildLinePath, buildAreaPath, pickAxisTicks } from './chartMath';

export interface StatsAreaChartPoint {
  day: string;
  value: number;
}

interface StatsAreaChartProps {
  data: StatsAreaChartPoint[];
  color: string;
  height?: number;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
  formatDay?: (day: string) => string;
  gradientId: string;
}

export default function StatsAreaChart({
  data,
  color,
  height = 160,
  emptyLabel = 'Todavía no hay datos suficientes para este período',
  formatValue = (value) => String(value),
  formatDay = (day) => day,
  gradientId,
}: StatsAreaChartProps) {
  const [width, setWidth] = React.useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const hasData = data.length >= 2 && data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <View style={[styles.emptyContainer, { height }]} onLayout={handleLayout}>
        <AppText variant="caption" align="center">{emptyLabel}</AppText>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const { max } = computeChartDomain(values);
  const points = width > 0 ? scalePoints(values, width, height) : [];
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, height);
  const lastPoint = points[points.length - 1];
  const lastValue = data[data.length - 1].value;
  const tickIndices = pickAxisTicks(data.length, 4);

  return (
    <View onLayout={handleLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.35} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={colors.border.subtle} strokeWidth={1} />
            <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
            <Path d={linePath} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {lastPoint && <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />}
          </Svg>
          <View style={styles.axisRow}>
            {tickIndices.map((index) => (
              <AppText key={data[index].day} variant="caption" style={styles.axisLabel}>
                {formatDay(data[index].day)}
              </AppText>
            ))}
          </View>
          <View style={styles.footerRow}>
            <AppText variant="caption">Máximo del período</AppText>
            <AppText variant="label" color={color}>{formatValue(max)}</AppText>
            {lastValue > 0 && (
              <AppText variant="caption">· hoy: {formatValue(lastValue)}</AppText>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    minWidth: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.sm,
  },
});
