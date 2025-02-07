/*
 * External dependencies
 */
import {
	ERROR_NETWORK,
	ERROR_QUOTA_EXCEEDED,
	useAiSuggestions,
} from '@automattic/jetpack-ai-client';
import { BlockControls, useBlockProps } from '@wordpress/block-editor';
import { createHigherOrderComponent } from '@wordpress/compose';
import { dispatch, select } from '@wordpress/data';
import { useCallback, useEffect, useState, useRef } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import debugFactory from 'debug';
import React from 'react';
/*
 * Internal dependencies
 */
import { EXTENDED_INLINE_BLOCKS } from '../extensions/ai-assistant';
import useAiFeature from '../hooks/use-ai-feature';
import { mapInternalPromptTypeToBackendPromptType } from '../lib/prompt/backend-prompt';
import { blockHandler } from './block-handler';
import AiAssistantInput from './components/ai-assistant-input';
import AiAssistantExtensionToolbarDropdown from './components/ai-assistant-toolbar-dropdown';
import { isPossibleToExtendBlock } from './lib/is-possible-to-extend-block';
/*
 * Types
 */
import type {
	AiAssistantDropdownOnChangeOptionsArgProps,
	OnRequestSuggestion,
} from '../components/ai-assistant-toolbar-dropdown/dropdown-content';
import type { ExtendedInlineBlockProp } from '../extensions/ai-assistant';
import type { PromptTypeProp } from '../lib/prompt';

const debug = debugFactory( 'jetpack-ai-assistant:extensions:with-ai-extension' );

const blockExtensionMapper = {
	'core/heading': 'heading',
};

type RequestOptions = {
	promptType: PromptTypeProp;
	options?: AiAssistantDropdownOnChangeOptionsArgProps;
	humanText?: string;
};

// HOC to populate the block's edit component with the AI Assistant bar and button.
const blockEditWithAiComponents = createHigherOrderComponent( BlockEdit => {
	return props => {
		const { clientId, isSelected, name: blockName } = props;
		const controlRef: React.MutableRefObject< HTMLDivElement | null > = useRef( null );
		const controlHeight = useRef< number >( 0 );
		const inputRef: React.MutableRefObject< HTMLInputElement | null > = useRef( null );
		const controlObserver = useRef< ResizeObserver | null >( null );
		const blockStyle = useRef< string >( '' );
		const ownerDocument = useRef< Document >( document );
		const [ action, setAction ] = useState< string >( '' );
		const [ consecutiveRequestCount, setConsecutiveRequestCount ] = useState( 0 );
		const [ requestsRemaining, setRequestsRemaining ] = useState( 0 );
		const [ showUpgradeMessage, setShowUpgradeMessage ] = useState( false );
		const [ lastRequest, setLastRequest ] = useState< RequestOptions | null >( null );

		// Only extend the allowed block types.
		const possibleToExtendBlock = isPossibleToExtendBlock( {
			blockName,
			clientId,
		} );

		const [ showAiControl, setShowAiControl ] = useState( false );

		const { getCurrentPostId } = select( 'core/editor' );
		const postId = getCurrentPostId();

		const {
			increaseRequestsCount,
			dequeueAsyncRequest,
			requireUpgrade,
			requestsCount,
			requestsLimit,
			loading: loadingAiFeature,
			nextTier,
		} = useAiFeature();

		useEffect( () => {
			const remaining = Math.max( requestsLimit - requestsCount, 0 );
			setRequestsRemaining( remaining );

			const quarterPlanLimit = requestsLimit ? requestsLimit / 4 : 5;
			setShowUpgradeMessage(
				// if the feature is not loading
				! loadingAiFeature &&
					// and there is a next plan
					!! nextTier &&
					// and the user requires an upgrade
					( requireUpgrade ||
						// or the user has reached a multiple of the quarter plan limit, e.g. 100, 75, 50, 25, and 0 on the 100 tier.
						remaining % quarterPlanLimit === 0 )
			);
		}, [
			requestsLimit,
			requestsCount,
			loadingAiFeature,
			nextTier,
			requireUpgrade,
			requestsRemaining,
		] );

		const onDone = useCallback( () => {
			increaseRequestsCount();
			setConsecutiveRequestCount( count => count + 1 );
			inputRef.current?.focus();
			setAction( '' );
			setLastRequest( null );
		}, [ increaseRequestsCount ] );

		const onError = useCallback(
			error => {
				setAction( '' );

				// Increase the AI Suggestion counter only for valid errors.
				if ( error.code === ERROR_NETWORK || error.code === ERROR_QUOTA_EXCEEDED ) {
					return;
				}

				increaseRequestsCount();
			},
			[ increaseRequestsCount ]
		);

		const { id } = useBlockProps();

		// Data and functions with block-specific implementations.
		const { onSuggestion: onBlockSuggestion, getContent } = blockHandler( blockName, clientId );

		const onSuggestion = useCallback(
			( suggestion: string ) => {
				onBlockSuggestion( suggestion );

				// Make sure the block element has the necessary bottom padding, as it can be replaced or changed
				const block = ownerDocument.current.getElementById( id );
				if ( block && controlRef.current ) {
					block.style.paddingBottom = `${ controlHeight.current + 16 }px`;
				}
			},
			[ id, onBlockSuggestion ]
		);

		const {
			request,
			stopSuggestion,
			requestingState,
			error,
			reset: resetSuggestions,
		} = useAiSuggestions( {
			onSuggestion,
			onDone,
			onError,
			askQuestionOptions: {
				postId,
				feature: 'ai-assistant',
			},
		} );

		useEffect( () => {
			if ( inputRef.current ) {
				// Save the block's ownerDocument to use it later, as the editor can be in an iframe.
				ownerDocument.current = inputRef.current.ownerDocument;
				// Focus the input when the AI Control is displayed.
				inputRef.current.focus();
			}
		}, [ showAiControl ] );

		useEffect( () => {
			let block = ownerDocument.current.getElementById( id );

			if ( ! block ) {
				return;
			}

			// Once when the AI Control is displayed
			if ( showAiControl && ! controlObserver.current && controlRef.current ) {
				// Save the block and control styles to adjust them later.
				blockStyle.current = block.style.cssText;

				// Observe the control's height to adjust the block's bottom-padding.
				controlObserver.current = new ResizeObserver( ( [ entry ] ) => {
					// The block element can be replaced or changed, so we need to get it again.
					block = ownerDocument.current.getElementById( id );
					controlHeight.current = entry.contentRect.height;

					if ( block && controlRef.current && controlHeight.current > 0 ) {
						block.style.paddingBottom = `${ controlHeight.current + 16 }px`;
						controlRef.current.style.marginTop = `-${ controlHeight.current }px`;
					}
				} );

				controlObserver.current.observe( controlRef.current );
			} else if ( controlObserver.current ) {
				// Reset the block's bottom-padding.
				block.setAttribute( 'style', blockStyle.current );

				controlObserver.current.disconnect();
				controlObserver.current = null;
				controlHeight.current = 0;
			}
		}, [ clientId, controlObserver, id, showAiControl ] );

		// Only extend the target block.
		if ( ! possibleToExtendBlock ) {
			return <BlockEdit { ...props } />;
		}

		// Defines where the block controls should be placed in the toolbar
		const blockControlsProps = {
			group: 'block' as const,
		};

		const onAskAiAssistant = () => {
			setShowAiControl( true );
		};

		const getRequestMessages = ( {
			promptType,
			options,
		}: {
			promptType: PromptTypeProp;
			options?: AiAssistantDropdownOnChangeOptionsArgProps;
		} ) => {
			const blockContent = getContent();

			const extension = blockExtensionMapper[ blockName ];

			return [
				{
					role: 'jetpack-ai' as const,
					context: {
						type: mapInternalPromptTypeToBackendPromptType( promptType, extension ),
						content: blockContent,
						request: options?.userPrompt,
						tone: options?.tone,
						language: options?.language,
					},
				},
			];
		};

		const onRequestSuggestion: OnRequestSuggestion = ( promptType, options, humanText ) => {
			setShowAiControl( true );

			if ( humanText ) {
				setAction( humanText );
			}

			const messages = getRequestMessages( { promptType, options } );

			debug( 'onRequestSuggestion', promptType, options );

			setLastRequest( { promptType, options, humanText } );

			/*
			 * Always dequeue/cancel the AI Assistant feature async request,
			 * in case there is one pending,
			 * when performing a new AI suggestion request.
			 */
			dequeueAsyncRequest();

			request( messages );
		};

		const onClose = useCallback( () => {
			setShowAiControl( false );
			resetSuggestions();
			setAction( '' );
			setConsecutiveRequestCount( 0 );
			setLastRequest( null );
		}, [ resetSuggestions ] );

		const onUserRequest = ( userPrompt: string ) => {
			const promptType = 'userPrompt';
			const options = { userPrompt };
			const messages = getRequestMessages( { promptType, options } );

			setLastRequest( { promptType, options } );

			dequeueAsyncRequest();

			request( messages );
		};

		// Close the AI Control if the block is deselected.
		useEffect( () => {
			if ( ! isSelected ) {
				onClose();
			}
		}, [ isSelected, onClose ] );

		const onUndo = async () => {
			for ( let i = 0; i < consecutiveRequestCount; i++ ) {
				await dispatch( 'core/editor' ).undo();
			}

			onClose();
		};

		const onTryAgain = () => {
			if ( lastRequest ) {
				onRequestSuggestion( lastRequest.promptType, lastRequest.options, lastRequest.humanText );
			}
		};

		return (
			<>
				<BlockEdit { ...props } />

				{ showAiControl && (
					<AiAssistantInput
						requestingState={ requestingState }
						requestingError={ error }
						wrapperRef={ controlRef }
						inputRef={ inputRef }
						action={ action }
						showUpgradeMessage={ showUpgradeMessage }
						requireUpgrade={ requireUpgrade }
						requestsRemaining={ requestsRemaining }
						request={ onUserRequest }
						stopSuggestion={ stopSuggestion }
						close={ onClose }
						undo={ onUndo }
						tryAgain={ onTryAgain }
					/>
				) }

				<BlockControls { ...blockControlsProps }>
					<AiAssistantExtensionToolbarDropdown
						blockType={ blockName }
						onAskAiAssistant={ onAskAiAssistant }
						onRequestSuggestion={ onRequestSuggestion }
					/>
				</BlockControls>
			</>
		);
	};
}, 'blockEditWithAiComponents' );

/**
 * Function used to extend the registerBlockType settings.
 * Populates the block edit component with the AI Assistant bar and button.
 * @param {object} settings - The block settings.
 * @param {string} name     - The block name.
 * @returns {object}          The extended block settings.
 */
function blockWithInlineExtension( settings, name: ExtendedInlineBlockProp ) {
	// Only extend the allowed block types.
	if ( ! EXTENDED_INLINE_BLOCKS.includes( name ) ) {
		return settings;
	}

	return {
		...settings,
		edit: blockEditWithAiComponents( settings.edit ),
	};
}

addFilter(
	'blocks.registerBlockType',
	'jetpack/ai-assistant-support/with-ai-extension',
	blockWithInlineExtension,
	100
);
