/*
 * External dependencies
 */
import { ExtensionAIControl } from '@automattic/jetpack-ai-client';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import React from 'react';
/*
 * Internal dependencies
 */
import useAICheckout from '../../../hooks/use-ai-checkout';
/*
 * Types
 */
import type { RequestingErrorProps, RequestingStateProp } from '@automattic/jetpack-ai-client';
import type { ReactElement, MouseEvent } from 'react';

export type AiAssistantInputProps = {
	requestingState: RequestingStateProp;
	requestingError?: RequestingErrorProps;
	inputRef?: React.MutableRefObject< HTMLInputElement | null >;
	wrapperRef?: React.MutableRefObject< HTMLDivElement | null >;
	action?: string;
	showUpgradeMessage?: boolean;
	requireUpgrade?: boolean;
	requestsRemaining?: number;
	request: ( question: string ) => void;
	stopSuggestion?: () => void;
	close?: () => void;
	undo?: () => void;
	tryAgain?: () => void;
};

export default function AiAssistantInput( {
	requestingState,
	requestingError,
	inputRef,
	wrapperRef,
	action,
	showUpgradeMessage = false,
	requireUpgrade = false,
	requestsRemaining = 0,
	request,
	stopSuggestion,
	close,
	undo,
	tryAgain,
}: AiAssistantInputProps ): ReactElement {
	const [ value, setValue ] = useState( '' );
	const [ placeholder, setPlaceholder ] = useState( __( 'Ask Jetpack AI to edit…', 'jetpack' ) );
	const [ showGuideLine, setShowGuideLine ] = useState( false );
	const disabled = requireUpgrade || [ 'requesting', 'suggesting' ].includes( requestingState );
	const { autosaveAndRedirect } = useAICheckout();

	function handleSend(): void {
		request?.( value );
	}

	function handleStopSuggestion(): void {
		stopSuggestion?.();
	}

	function handleClose(): void {
		close?.();
	}

	function handleUndo(): void {
		undo?.();
	}

	const handleUpgrade = useCallback(
		( event: MouseEvent< HTMLButtonElement > ) => {
			autosaveAndRedirect( event );
		},
		[ autosaveAndRedirect ]
	);

	function handleTryAgain(): void {
		tryAgain?.();
	}

	// Clear the input value on reset and when the request is done.
	useEffect( () => {
		if ( [ 'init', 'done' ].includes( requestingState ) ) {
			setValue( '' );
		}
	}, [ requestingState ] );

	// Set the value to the quick action text once it changes.
	useEffect( () => {
		setPlaceholder( action || __( 'Ask Jetpack AI to edit…', 'jetpack' ) );

		// Clear the input value when the action changes.
		if ( action ) {
			setValue( '' );
		}
	}, [ action ] );

	// Show the guideline message when there is some text in the input.
	useEffect( () => {
		setShowGuideLine( value.length > 0 );
	}, [ value ] );

	return (
		<ExtensionAIControl
			placeholder={ placeholder }
			disabled={ disabled }
			value={ value }
			state={ requestingState }
			showGuideLine={ showGuideLine }
			error={ requestingError?.message }
			requestsRemaining={ requestsRemaining }
			showUpgradeMessage={ showUpgradeMessage }
			onChange={ setValue }
			onSend={ handleSend }
			onStop={ handleStopSuggestion }
			onClose={ handleClose }
			onUndo={ handleUndo }
			onUpgrade={ handleUpgrade }
			onTryAgain={ handleTryAgain }
			wrapperRef={ wrapperRef }
			ref={ inputRef }
		/>
	);
}
