import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

import '../features/care/domain/care_type.dart';

/// Токены из docs/plant-app/DESIGN.md.
@immutable
class GardenColors extends ThemeExtension<GardenColors> {
  const GardenColors({
    required this.leaf,
    required this.water,
    required this.soil,
    required this.mist,
    required this.alert,
    required this.surfaceMuted,
    required this.secondaryLabel,
  });

  final Color leaf;
  final Color water;
  final Color soil;
  final Color mist;
  final Color alert;
  final Color surfaceMuted;
  final Color secondaryLabel;

  static const light = GardenColors(
    leaf: Color(0xFF2E7D4F),
    water: Color(0xFF2F80ED),
    soil: Color(0xFFC8643B),
    mist: Color(0xFF12A3A3),
    alert: Color(0xFFE5484D),
    surfaceMuted: Color(0xFFF1F1EC),
    secondaryLabel: Color(0xFF6E6E73),
  );

  static const dark = GardenColors(
    leaf: Color(0xFF4CC77F),
    water: Color(0xFF5AA2FF),
    soil: Color(0xFFE8845A),
    mist: Color(0xFF3CC8C8),
    alert: Color(0xFFFF6369),
    surfaceMuted: Color(0xFF2C2C2E),
    secondaryLabel: Color(0xFFA1A1A6),
  );

  Color forCare(CareType type) => switch (type) {
        CareType.water => water,
        CareType.mist => mist,
        CareType.fertilize || CareType.repot => soil,
        CareType.treatPests => alert,
        _ => leaf,
      };

  @override
  GardenColors copyWith() => this;

  @override
  GardenColors lerp(GardenColors? other, double t) {
    if (other == null) return this;
    return GardenColors(
      leaf: Color.lerp(leaf, other.leaf, t)!,
      water: Color.lerp(water, other.water, t)!,
      soil: Color.lerp(soil, other.soil, t)!,
      mist: Color.lerp(mist, other.mist, t)!,
      alert: Color.lerp(alert, other.alert, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      secondaryLabel: Color.lerp(secondaryLabel, other.secondaryLabel, t)!,
    );
  }
}

extension GardenThemeX on BuildContext {
  GardenColors get garden => Theme.of(this).extension<GardenColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
}

abstract final class GardenTheme {
  static const double gutter = 20;
  static const double radiusSm = 12;
  static const double radiusMd = 20;
  static const double radiusLg = 28;

  static ThemeData light() => _build(
        brightness: Brightness.light,
        colors: GardenColors.light,
        background: const Color(0xFFFAFAF7),
        surface: Colors.white,
        label: const Color(0xFF1C1C1E),
      );

  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        colors: GardenColors.dark,
        background: Colors.black,
        surface: const Color(0xFF1C1C1E),
        label: const Color(0xFFF5F5F7),
      );

  static ThemeData _build({
    required Brightness brightness,
    required GardenColors colors,
    required Color background,
    required Color surface,
    required Color label,
  }) {
    final scheme = ColorScheme.fromSeed(
      seedColor: colors.leaf,
      brightness: brightness,
      primary: colors.leaf,
      surface: surface,
      onSurface: label,
      error: colors.alert,
    );

    // Шкала в духе iOS: Large Title 34, Title 22, Headline 17, Body 17, Callout 15, Caption 13.
    final text = TextTheme(
      displaySmall: TextStyle(fontSize: 34, fontWeight: FontWeight.w700, letterSpacing: -0.4, height: 1.15, color: label),
      headlineSmall: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: label),
      titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: label),
      titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: label),
      bodyLarge: TextStyle(fontSize: 17, height: 1.35, color: label),
      bodyMedium: TextStyle(fontSize: 15, height: 1.35, color: label),
      labelLarge: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      labelMedium: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: colors.secondaryLabel),
      bodySmall: TextStyle(fontSize: 13, color: colors.secondaryLabel),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      textTheme: text,
      extensions: [colors],
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: text.titleMedium,
        foregroundColor: label,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusMd)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusMd)),
          textStyle: text.labelLarge,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surfaceMuted,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(radiusSm), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colors.surfaceMuted,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusSm)),
        labelStyle: text.labelMedium?.copyWith(color: label),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface.withValues(alpha: 0.82),
        elevation: 0,
        height: 64,
        indicatorColor: colors.leaf.withValues(alpha: 0.14),
        labelTextStyle: WidgetStatePropertyAll(text.labelMedium?.copyWith(fontSize: 11)),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusSm)),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
