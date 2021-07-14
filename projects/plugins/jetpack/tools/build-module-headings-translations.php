<?php
/**
 * Creates the module-headings.php file.
 *
 * @package jetpack
 */

// phpcs:disable WordPress.WP.AlternativeFunctions

$all_module_headers = array(
	'name'                      => 'Module Name',
	'description'               => 'Module Description',
	'sort'                      => 'Sort Order',
	'recommendation_order'      => 'Recommendation Order',
	'introduced'                => 'First Introduced',
	'changed'                   => 'Major Changes In',
	'deactivate'                => 'Deactivate',
	'free'                      => 'Free',
	'requires_connection'       => 'Requires Connection',
	'requires_user_connection'  => 'Requires User Connection',
	'auto_activate'             => 'Auto Activate',
	'module_tags'               => 'Module Tags',
	'feature'                   => 'Feature',
	'additional_search_queries' => 'Additional Search Queries',
	'plan_classes'              => 'Plans',
);

// Contains all of the module info in an associative array with module slugs as keys.
$all_modules = array();

// Slugs for module files that do not have module info.
$no_info_slugs = array();

$jp_dir = dirname( __DIR__ ) . '/';
$files  = glob( "{$jp_dir}modules/*.php" );
$tags   = array(
	'Other' => array(),
);

foreach ( $files as $file ) {
	$absolute_path  = $file;
	$relative_path  = str_replace( $jp_dir, '', $file );
	$_file_contents = '';

	$file      = fopen( $absolute_path, 'r' );
	$file_data = fread( $file, 8192 );
	fclose( $file );

	$module_slug = str_replace( '.php', '', basename( $absolute_path ) );
	// Make sure we catch CR-only line endings.
	$file_data = str_replace( "\r", "\n", $file_data );

	foreach ( $all_module_headers as $field => $regex ) {
		if ( preg_match( '/^[ \t\/*#@]*' . preg_quote( $regex, '/' ) . ':(.*)$/mi', $file_data, $match ) && $match[1] ) {
			$string = trim( preg_replace( '/\s*(?:\*\/|\?>).*/', '', $match[1] ) );
			$string = addcslashes( $string, "''" );
			if ( 'Module Tags' === $regex ) {
				$module_tags = array_map( 'trim', explode( ',', $string ) );
				foreach ( $module_tags as $module_tag ) {
					$tags[ $module_tag ][] = $relative_path;
				}
			}

			$all_modules[ $module_slug ][ $field ] = $string;
		}
	}

	if ( ! isset( $all_modules[ $module_slug ]['name'] ) ) {
		// If the module info doesn't have a name, add the slug to the no info slugs list.
		$no_info_slugs[] = $module_slug;
	}
}

/*
 * Create the jetpack_get_module_i18n function.
 */
$file_contents = "<?php
/**
 * Do not edit this file. It's generated by `jetpack/tools/build-module-headings-translations.php`.
 *
 * @package automattic/jetpack
 */

// Pointless to do two passes over everything just for alignment.
// phpcs:disable WordPress.Arrays.MultipleStatementAlignment.DoubleArrowNotAligned

/**
 * For a given module, return an array with translated name and description.
 *
 * @param string \$key Module file name without `.php`.
 *
 * @return array
 */
function jetpack_get_module_i18n( \$key ) {
\tstatic \$modules;
\tif ( ! isset( \$modules ) ) {
\t\t\$modules = array(";

$i18n_headers = array(
	'name'        => 'Module Name',
	'description' => 'Module Description',
	'tags'        => 'Module Tags',
);

foreach ( $all_modules as $module_key => $module_info ) {
	$_file_contents = '';
	foreach ( $i18n_headers as $field => $description ) {
		if ( ! empty( $module_info[ $field ] ) ) {
			$_file_contents .= "\t\t\t\t'{$field}' => _x( '{$module_info[$field]}', '{$description}', 'jetpack' ),\n";
		}
	}

	if ( $_file_contents ) {
		$file_contents .= "\n\t\t\t'" . $module_key . "' => array(\n$_file_contents\t\t\t),\n";
	}
}

$file_contents .= "\t\t);
\t}";
$file_contents .= "\n\treturn \$modules[ \$key ];
}";

/*
 * Create the jetpack_get_module_i18n_tag function.
 */
$file_contents .= "

// The lists of filenames below shouldn't be arbitrarily punctuated, but the sniff triggers anyway.
// phpcs:disable Squiz.Commenting.InlineComment.InvalidEndChar

/**
 * For a given module tag, return its translated version.
 *
 * @param string \$key Module tag as is in each module heading.
 *
 * @return string
 */";
$file_contents .= "\nfunction jetpack_get_module_i18n_tag( \$key ) {
\tstatic \$module_tags;
\tif ( ! isset( \$module_tags ) ) {";
$file_contents .= "\n\t\t\$module_tags = array(";
foreach ( $tags as $tag_name => $tag_files ) {
	$file_contents .= "\n\t\t\t// Modules with `{$tag_name}` tag:\n";
	foreach ( $tag_files as $file ) {
		$file_contents .= "\t\t\t// - {$file}\n";
	}
	$file_contents .= "\t\t\t'{$tag_name}' => _x( '{$tag_name}', 'Module Tag', 'jetpack' ),\n";
}
$file_contents .= "\t\t);
\t}";
$file_contents .= "\n\treturn ! empty( \$module_tags[ \$key ] ) ? \$module_tags[ \$key ] : '';
}\n";

/*
 * Create the jetpack_get_module_info function.
 */
$file_contents .= "
/**
 * For a given module, return an array with the module info.
 *
 * @param string \$key Module file name without `.php`.
 *
 * return array|string An array containing the module info or an empty string if the given module isn't known.
 */
function jetpack_get_module_info( \$key ) {
\tstatic \$module_info = array(";

foreach ( $all_modules as $module_key => $module_info ) {
	$_file_contents = '';
	foreach ( $all_module_headers as $field => $regex ) {
		if ( ! empty( $module_info[ $field ] ) ) {
			$_file_contents .= "\t\t\t'{$field}' => '{$module_info[$field]}',\n";
		} else {
			$_file_contents .= "\t\t\t'{$field}' => '',\n";
		}
	}

	if ( $_file_contents ) {
		$file_contents .= "\n\t\t'" . $module_key . "' => array(\n$_file_contents\t\t),\n";
	}
}
$file_contents .= "\t);";
$file_contents .= "\n\treturn isset( \$module_info[ \$key ] ) ? \$module_info[ \$key ] : null;
}\n";

/*
 * Create the jetpack_get_all_module_header_names function.
 */
$file_contents .= "
/**
 * Return an array containing all module header names.
 *
 * @return array
 */
function jetpack_get_all_module_header_names() {
\treturn array(\n";

foreach ( $all_module_headers as $field => $description ) {
	$file_contents .= "\t\t'{$field}' => '{$description}',\n";
}

$file_contents .= "\t);
}\n";

/*
 * Create the jetpack_has_no_module_info function.
 */
$file_contents .= "
/**
 * Returns whether the file associated with the given slug has no module info.
 *
 * @param string \$slug The slug name.
 *
 * @return bool Whether the file has no module info.
 */
function jetpack_has_no_module_info( \$slug ) {
\t\$no_info_slugs = array(\n";

foreach ( $no_info_slugs as $slug ) {
	$file_contents .= "\t\t'{$slug}',\n";
}

$file_contents .= "\t);

\tif ( in_array( \$slug, \$no_info_slugs, true ) ) {
\t	return true;
\t}

\treturn false;
}\n";

file_put_contents( "{$jp_dir}modules/module-headings.php", $file_contents );
